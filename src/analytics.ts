import { startOfMonth, subMonths } from "date-fns";
import type { AnalysisSettings, CandidateCombination, CombinationScoreRanges, Confidence, Draw, ModelSignal, NumberState, PairStats, PeriodPreset, PowerSuggestionMode, SingleNumberStats, TripleStats } from "./domain";
import { INSIDE_SET } from "./domain";

export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const calibrateProposalScore=(score:number)=>round2(50+.8*(score-50));
export const pad = (n: number) => String(n).padStart(2, "0");
export function weightedAverage(values:number[],weights:number[]):number{
  const total=weights.reduce((sum,weight)=>sum+weight,0);
  if(values.length!==weights.length||!Number.isFinite(total)||total<=0||weights.some(weight=>!Number.isFinite(weight)||weight<0))throw new RangeError("Weights must be finite, nonnegative, and sum to more than zero");
  return values.reduce((sum,value,index)=>sum+value*weights[index],0)/total;
}
/**
 * Scores a subset's historical inclusion rate against the exact 6-of-M null.
 * Beta-prior pseudo-draws shrink sparse observations toward chance, with more
 * shrinkage for higher-order subsets. 50 is chance-level; scores are ranking
 * signals, not probabilities that a number will be drawn next.
 */
export function chanceAdjustedSubsetScore(observed:number,drawCount:number,subsetSize:1|2|3,maxNumber:number,drawSize=6):number{
  if(drawCount<=0||maxNumber<drawSize||subsetSize>drawSize)return 50;
  let baseline=1;
  for(let i=0;i<subsetSize;i++)baseline*=(drawSize-i)/(maxNumber-i);
  const strength=18*Math.pow(subsetSize,1.5)*Math.sqrt(100/Math.max(drawCount,10));
  const posterior=(Math.max(0,observed)+strength*baseline)/(drawCount+strength);
  const epsilon=1e-12;
  const logit=(value:number)=>Math.log(clamp(value,epsilon,1-epsilon)/(1-clamp(value,epsilon,1-epsilon)));
  const relativeOdds=logit(posterior)-logit(baseline);
  return round2(100/(1+Math.exp(-relativeOdds)));
}
export function filterCombinationsByNumbers<T extends {numbers:number[]}>(items:T[],query:string):T[]{
  const value=query.trim();
  if(!value)return items;
  const numbers=[...new Set((value.match(/\d{1,2}/g)??[]).map(Number))];
  if(!numbers.length||numbers.length>6)return [];
  return items.filter(item=>numbers.every(number=>item.numbers.includes(number)));
}
export const combinationScoreKeys=["singleScore","pairScore","gapScore","structureScore","totalScore"] as const;
export type {CombinationScoreRanges} from "./domain";
export function validCombinationScoreRanges(ranges:CombinationScoreRanges):boolean{
  return combinationScoreKeys.every(key=>{
    const {min,max}=ranges[key];
    const lower=min.trim()===""?null:Number(min);
    const upper=max.trim()===""?null:Number(max);
    return [lower,upper].every(value=>value===null||(Number.isFinite(value)&&value>=0&&value<=100))&&(lower===null||upper===null||lower<=upper);
  });
}
export function filterCombinationsByScores<T extends Pick<CandidateCombination,(typeof combinationScoreKeys)[number]>>(items:T[],ranges:CombinationScoreRanges):T[]{
  return items.filter(item=>combinationScoreKeys.every(key=>{
    const {min,max}=ranges[key];
    return (min.trim()===""||item[key]>=Number(min))&&(max.trim()===""||item[key]<=Number(max));
  }));
}
export type CompactCombinationIssue={entryIndex:number;chunkIndex?:number;value:string};
export function parseCompactCombinations(input:string,maxNumber:number,drawSize=6){
  const entries=input.split(/[,\n]+/).map(value=>value.trim()).filter(Boolean);
  const issues:CompactCombinationIssue[]=[];
  const combinations=entries.flatMap((entry,entryIndex)=>{
    const compact=entry.replace(/[\s-]+/g,"");
    if(!new RegExp(`^\\d{${drawSize*2}}$`).test(compact)){issues.push({entryIndex,value:entry});return [];}
    const numbers=(compact.match(/\d{2}/g)??[]).map((value,chunkIndex)=>{const number=Number(value);if(number<1||number>maxNumber)issues.push({entryIndex,chunkIndex,value});return number;});
    numbers.forEach((number,chunkIndex)=>{if(numbers.indexOf(number)!==chunkIndex)issues.push({entryIndex,chunkIndex,value:pad(number)});});
    return issues.some(issue=>issue.entryIndex===entryIndex)?[]:[numbers.sort((a,b)=>a-b)];
  });
  return {entries,issues,combinations,valid:entries.length>0&&issues.length===0};
}
export const digitalRoot = (n: number) => n <= 0 ? 0 : 1 + ((n - 1) % 9);
export const combinations = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length === size) { result.push([...picked]); return; }
    for (let i = start; i <= items.length - (size - picked.length); i++) {
      picked.push(items[i]); walk(i + 1, picked); picked.pop();
    }
  };
  walk(0, []);
  return result;
};

export const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
export const median = (values: number[]) => quantile(values, .5);
export const variance = (values: number[]) => {const average=mean(values);return values.length ? mean(values.map(value => (value - average) ** 2)) : 0;};
export const stdDev = (values: number[]) => Math.sqrt(variance(values));
export function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  const position = (sorted.length - 1) * clamp(q,0,1);
  const base = Math.floor(position);
  const remainder = position - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + remainder * (sorted[base + 1] - sorted[base]);
}
export const percentileRank = (values: number[], value: number):number|null => values.length ? 100*(values.filter(item=>item<value).length+.5*values.filter(item=>item===value).length)/values.length : null;
export const zScore = (value: number, average: number, sigma: number) => sigma > 0 ? (value - average) / sigma : 0;
export function normalizeMinMax(values: number[]) {
  const min = Math.min(...values), max = Math.max(...values);
  return values.map(value => max === min ? 50 : (value - min) / (max - min) * 100);
}
const signal = (rawScore:number, normalizedScore:number, explanation:string[], confidence:Confidence="MEDIUM"):ModelSignal => ({rawScore:round2(rawScore),normalizedScore:round2(clamp(normalizedScore)),percentileRank:0,rank:0,confidence,explanation});
const ratio = (numerator:number,numeratorWindow:number,denominator:number,denominatorWindow:number) => denominator ? (numerator / Math.max(1,numeratorWindow)) / (denominator / Math.max(1,denominatorWindow)) : 0;
const pairConfidence = (count:number):Confidence => count >= 6 ? "HIGH" : count >= 3 ? "MEDIUM" : "LOW";

export function filterDraws(draws: Draw[], period: PeriodPreset, fromDate?: string, toDate?: string) {
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if (period === "all") return ordered;
  if (period === "custom") return ordered.filter(d => (!fromDate || d.date >= fromDate) && (!toDate || d.date <= toDate));
  if (period.startsWith("last") && !period.includes("month") && !period.includes("year")) return ordered.slice(-Number(period.replace("last", "")));
  const latest = new Date(`${ordered.at(-1)?.date ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
  const start = subMonths(latest, period === "last6months" ? 6 : 12);
  return ordered.filter(d => {
    const date = new Date(`${d.date}T00:00:00`);
    return date >= start && date <= latest;
  });
}

export function periodHalfLife(period:PeriodPreset,drawCount:number,configured=30){
  const scale=configured/30;
  if(period==="last10"||period==="last20")return 10*scale;
  if(period==="last30"||period==="last40"||period==="last50"||period==="last60")return 20*scale;
  if(period==="last100")return 30*scale;
  if(period==="last6months")return 35*scale;
  if(period==="last1year")return 37.5*scale;
  if(period==="all")return 45*scale;
  const anchors:[[number,number],[number,number],[number,number],[number,number]]=[[10,10],[50,20],[100,30],[300,45]];
  const length=Math.max(0,drawCount);
  const index=anchors.findIndex(([upper])=>length<=upper);
  if(index<0)return 45*scale;
  const [upper,value]=anchors[index];
  const [lower,prior]=anchors[Math.max(0,index-1)];
  return (index===0?value:prior+(value-prior)*(length-lower)/(upper-lower))*scale;
}

export function filterCompleteCalendarMonths(draws:Draw[],monthCount?:number){
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!ordered.length)return ordered;
  const end=startOfMonth(new Date(`${ordered.at(-1)!.date}T00:00:00`));
  const start=monthCount===undefined?startOfMonth(new Date(`${ordered[0].date}T00:00:00`)):subMonths(end,monthCount);
  return ordered.filter(draw=>{
    const date=new Date(`${draw.date}T00:00:00`);
    return date>=start&&date<end;
  });
}

export function calculateOccurrenceTimeline(draws: Draw[]) {
  const ordered = [...draws].sort((a, b) => a.date.localeCompare(b.date));
  const maxNumber=ordered.reduce((max,draw)=>draw.numbers.reduce((value,number)=>Math.max(value,number),max),0);
  const recentCounts=new Int32Array(maxNumber+1),points:{id:string;date:string;historicalFrequency:number}[]=[];
  for(let index=0;index<ordered.length;index++){
    const draw=ordered[index];
    points.push({id:draw.id,date:draw.date,historicalFrequency:draw.numbers.reduce((sum,number)=>sum+recentCounts[number],0)});
    for(const number of draw.numbers)recentCounts[number]++;
    if(index>=20)for(const number of ordered[index-20].numbers)recentCounts[number]--;
  }

  let movingSum=0;
  return points.map((point,index)=>{
    movingSum+=point.historicalFrequency;
    if(index>=20)movingSum-=points[index-20].historicalFrequency;
    return {...point,ma20:round2(movingSum/Math.min(20,index+1))};
  });
}

export function calculateMonthlyDraws(draws: Draw[]) {
  const monthly = new Map<string,number>();
  draws.forEach(draw => monthly.set(draw.date.slice(0,7),(monthly.get(draw.date.slice(0,7))??0)+1));
  return [...monthly.entries()]
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([month,draws])=>({month,draws}));
}

export function calculateWeightedFrequency(draws:Draw[],number:number,halfLife=30){const lambda=Math.log(2)/Math.max(1,halfLife);return draws.reduce((sum,draw,index)=>sum+(draw.numbers.includes(number)?Math.exp(-lambda*(draws.length-1-index)):0),0);}
export function calculateRollingFrequency(draws:Draw[],number:number){const count=(size:number)=>draws.slice(-size).filter(draw=>draw.numbers.includes(number)).length;return {last10:count(10),last20:count(20),last30:count(30),last50:count(50),last100:count(100),all:count(draws.length)};}
export function calculateExpectedFrequencyBand(totalDraws:number,maxNumber=45,drawSize=6){const p=drawSize/maxNumber,expected=totalDraws*p,sigma=Math.sqrt(totalDraws*p*(1-p));return {expected,sigma,lower95:Math.max(0,expected-1.96*sigma),upper95:expected+1.96*sigma};}
export function calculateFrequencyZ(observed:number,totalDraws:number,maxNumber=45,drawSize=6){const {expected,sigma}=calculateExpectedFrequencyBand(totalDraws,maxNumber,drawSize);return zScore(observed,expected,sigma);}
const normalCdf=(value:number)=>{const sign=value<0?-1:1,x=Math.abs(value)/Math.sqrt(2),t=1/(1+.3275911*x),erf=sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+.254829592)*t*Math.exp(-x*x));return .5*(1+erf);};
export function calculateChiSquareUniformity(draws:Draw[],maxNumber=45){const expected=draws.length*(draws[0]?.numbers.length??6)/maxNumber;const counts=Array.from({length:maxNumber},(_,i)=>draws.filter(draw=>draw.numbers.includes(i+1)).length);const chiSquare=expected?counts.reduce((sum,count)=>sum+(count-expected)**2/expected,0):0;const df=maxNumber-1;const transformed=df?((chiSquare/df)**(1/3)-(1-2/(9*df)))/Math.sqrt(2/(9*df)):0;return {chiSquare:round2(chiSquare),degreesOfFreedom:df,pValue:clamp(1-normalCdf(transformed),0,1)};}
export function calculateGapDistribution(draws:Draw[],number:number,minCompletedGaps=4){
  const appearances=draws.flatMap((draw,index)=>draw.numbers.includes(number)?[index]:[]);
  const gaps=appearances.slice(1).map((value,index)=>value-appearances[index]-1);
  const currentGap=appearances.length?draws.length-1-appearances.at(-1)!:draws.length;
  const meanGap=gaps.length?mean(gaps):null;
  const stdGap=gaps.length?stdDev(gaps):null;
  const gapPercentile=percentileRank(gaps,currentGap);
  const gapZ=meanGap!==null&&stdGap!==null&&stdGap>0?zScore(currentGap,meanGap,stdGap):null;
  const gapCV=meanGap!==null&&meanGap>0&&stdGap!==null?stdGap/meanGap:null;
  const gapSupport=Math.min(1,gaps.length/8);
  const gapScore=gaps.length>=minCompletedGaps?50+50*normalCdf(gapZ??0)*gapSupport:50;
  return {gaps,currentGap,meanGap,medianGap:gaps.length?median(gaps):null,minGap:gaps.length?Math.min(...gaps):null,maxGap:gaps.length?Math.max(...gaps):null,maxCompletedGap:gaps.length?Math.max(...gaps):null,stdGap,q1:gaps.length?quantile(gaps,.25):null,q3:gaps.length?quantile(gaps,.75):null,gapPercentile,gapZ,gapCV,completedGapCount:gaps.length,gapSupport,gapCensored:appearances.length===0,gapScore:round2(gapScore)};
}
export function calculateTransitionMatrix(draws:Draw[],maxNumber=45){const counts=Array.from({length:maxNumber},()=>Array(maxNumber).fill(0));const eligible=Array(maxNumber).fill(0);for(let i=0;i<draws.length-1;i++)for(const a of draws[i].numbers){eligible[a-1]++;for(const b of draws[i+1].numbers)counts[a-1][b-1]++;}return {counts,eligible};}
export function calculateTransitionLift(draws:Draw[],a:number,b:number,maxNumber=45){const {counts,eligible}=calculateTransitionMatrix(draws,maxNumber);const rate=eligible[a-1]?counts[a-1][b-1]/eligible[a-1]:0;const baseline=draws.length?draws.filter(draw=>draw.numbers.includes(b)).length/draws.length:0;return baseline?rate/baseline:0;}
export function calculateDrawStructure(draw:Draw,maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET]){const size=draw.numbers.length,insideSet=new Set(insideNumbers),values=[...draw.numbers].sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0),evenCount=values.filter(n=>n%2===0).length,insideCount=values.filter(n=>insideSet.has(n)).length,lowCount=values.filter(n=>n<=Math.floor(maxNumber/2)).length;return {sum,mean:sum/size,median:median(values),min:values[0],max:values.at(-1)!,spread:values.at(-1)!-values[0],evenCount,oddCount:size-evenCount,insideCount,outsideCount:size-insideCount,lowCount,highCount:size-lowCount,consecutivePairs:values.slice(1).filter((n,i)=>n-values[i]===1).length,digitalRoot:digitalRoot(sum),decadeDistribution:Array.from({length:Math.ceil(maxNumber/10)},(_,i)=>i*10).map(start=>values.filter(n=>n>start&&n<=Math.min(start+10,maxNumber)).length)};}
export function calculateStructureDistribution(draws:Draw[],maxNumber=45){const structures=draws.map(draw=>calculateDrawStructure(draw,maxNumber));return {structures,sum:{mean:mean(structures.map(x=>x.sum)),median:median(structures.map(x=>x.sum)),stdDev:stdDev(structures.map(x=>x.sum)),q1:quantile(structures.map(x=>x.sum),.25),q3:quantile(structures.map(x=>x.sum),.75)}};}
export function calculateNoveltyScore(numbers:number[],history:Draw[]){const size=numbers.length,maxHistoricalOverlap=history.length?Math.max(...history.map(draw=>numbers.filter(number=>draw.numbers.includes(number)).length)):0;return {maxHistoricalOverlap,score:clamp(100-maxHistoricalOverlap/size*100)};}
export function detectStatisticalAnomalies(singles:SingleNumberStats[],settings:AnalysisSettings){return singles.flatMap(item=>{const result:{number:number;type:string;severity:string;value:number;explanation:string}[]=[];if(Math.abs(item.frequencyZ)>=(settings.frequencyZAlertThreshold??2))result.push({number:item.number,type:item.frequencyZ>0?"FREQUENCY_HIGH":"FREQUENCY_LOW",severity:Math.abs(item.frequencyZ)>=3?"STRONG":"WARNING",value:item.frequencyZ,explanation:`Historical frequency Z ${round2(item.frequencyZ)}`});const percentile=item.gap.gapPercentile,z=item.gap.gapZ;if(!item.gap.gapCensored&&((percentile!==null&&percentile>=(settings.gapPercentileAlertThreshold??95))||(z!==null&&z>=(settings.gapZAlertThreshold??2))))result.push({number:item.number,type:"GAP_HIGH",severity:percentile!==null&&percentile>=99?"STRONG":"WARNING",value:percentile??0,explanation:`Current gap is unusually long relative to this number's history (${percentile===null?"N/A":round2(percentile)}th percentile)`});if(Math.abs(item.recentZ30)>=(settings.recentZAlertThreshold??2))result.push({number:item.number,type:item.recentZ30>0?"RECENT_HIGH":"RECENT_LOW",severity:Math.abs(item.recentZ30)>=3?"STRONG":"WARNING",value:item.recentZ30,explanation:`Recent historical frequency Z ${round2(item.recentZ30)}`});return result;});}

export function calculateSingles(draws: Draw[], settings: AnalysisSettings,maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET],period:PeriodPreset="custom"): SingleNumberStats[] {
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const totalDraws=ordered.length;
  const p=(ordered[0]?.numbers.length??6)/maxNumber;
  const insideSet=new Set(insideNumbers);
  const expectedCount=totalDraws*p;
  const sigma=Math.sqrt(totalDraws*p*(1-p));
  const windowCount=(number:number,size:number)=>ordered.slice(-size).filter(draw=>draw.numbers.includes(number)).length;
  const raw = Array.from({ length:maxNumber }, (_, index) => {
    const number = index + 1;
    const gap=calculateGapDistribution(ordered,number,settings.minCompletedGaps);
    const totalCount = ordered.filter(draw=>draw.numbers.includes(number)).length;
    const {currentGap}=gap;
    const averageGap=gap.meanGap;
    const maxGap=gap.maxCompletedGap;
    const rolling={last10:windowCount(number,10),last20:windowCount(number,20),last30:windowCount(number,30),last50:windowCount(number,50),last100:windowCount(number,100),all:totalCount};
    const countLast10 = rolling.last10;
    const countLast30 = rolling.last30;
    const frequencyRate = totalDraws ? totalCount / totalDraws : 0;
    const recentRate = totalDraws ? countLast30 / Math.min(30, totalDraws) : 0;
    const trend30 = frequencyRate > 0 ? recentRate / frequencyRate : 0;
    const gapRatio = averageGap !== null&&averageGap>0 ? currentGap / averageGap : null;
    const state: NumberState = gap.gapCensored?"DROUGHT":trend30 >= 1.3 && gapRatio !== null&&gapRatio < .8 ? "HOT" : gapRatio !== null&&gapRatio >= 2 ? "DROUGHT" : gapRatio !== null&&gapRatio >= 1.5 ? "DUE" : trend30 < .8 ? "COOL" : "NEUTRAL";
    const lambda=Math.log(2)/Math.max(1,periodHalfLife(period,totalDraws,settings.weightedFrequencyHalfLife ?? 30));
    const weightedFrequency=ordered.reduce((sum,draw,drawIndex)=>sum+(draw.numbers.includes(number)?Math.exp(-lambda*(totalDraws-1-drawIndex)):0),0);
    const ratio10vs30=ratio(rolling.last10,Math.min(10,totalDraws),rolling.last30,Math.min(30,totalDraws));
    const ratio10vs50=ratio(rolling.last10,Math.min(10,totalDraws),rolling.last50,Math.min(50,totalDraws));
    const ratio30vs100=ratio(rolling.last30,Math.min(30,totalDraws),rolling.last100,Math.min(100,totalDraws));
    const label:SingleNumberStats["momentum"]["label"]=ratio10vs30>1.4?"ACCELERATING":ratio10vs30>=1.1?"RISING":ratio10vs30>=.9?"STABLE":"FALLING";
    const recentN=Math.min(30,totalDraws), expected30=recentN*p, sigma30=Math.sqrt(recentN*p*(1-p));
    return { number,totalCount,frequencyRate,currentGap,averageGap,maxGap,countLast10,countLast30,trend30,gapRatio,state,inside:insideSet.has(number),parity:number%2?"ODD" as const:"EVEN" as const,weightedFrequency,rolling,expectedCount,lower95:Math.max(0,expectedCount-1.96*sigma),upper95:expectedCount+1.96*sigma,frequencyZ:zScore(totalCount,expectedCount,sigma),recentZ30:zScore(countLast30,expectedCount===0?0:p*Math.min(30,totalDraws),sigma30),gap,momentum:{ratio10vs30,ratio10vs50,ratio30vs100,label}};
  });
  const weightedScores=normalizeMinMax(raw.map(item=>item.weightedFrequency));
  const rollingRanks=raw.map(item=>percentileRank(raw.map(x=>x.rolling.last30),item.rolling.last30)??50);
  const pairCounts=Array.from({length:maxNumber+1},()=>Array(maxNumber+1).fill(0));
  ordered.forEach(draw=>combinations([...draw.numbers],2).forEach(([a,b])=>{pairCounts[a][b]++;pairCounts[b][a]++;}));
  const associationRaw=raw.map(item=>{
    const lifts:number[]=[];
    for(let other=1;other<=maxNumber;other++) if(other!==item.number){const pairCount=pairCounts[item.number][other];const otherCount=raw[other-1]?.totalCount??0;const expected=totalDraws?(item.totalCount/totalDraws)*(otherCount/totalDraws):0;if(pairCount>=(settings.minPairSupport??2)&&expected>0)lifts.push((pairCount/totalDraws)/expected);}
    return mean(lifts.sort((a,b)=>b-a).slice(0,5));
  });
  const associationScores=normalizeMinMax(associationRaw);
  const scored=raw.map((item,index)=>{
    const frequencyScore=.35*clamp(50+item.frequencyZ*15)+.40*weightedScores[index]+.25*rollingRanks[index];
    const momentumScore=.5*clamp(item.momentum.ratio10vs30/1.5*100)+.3*clamp(item.momentum.ratio30vs100/1.5*100)+.2*clamp(50+item.recentZ30*15);
    const gapScore=item.gap.gapScore;
    const supportConfidence:Confidence=totalDraws>=100?"HIGH":totalDraws>=50?"MEDIUM":"LOW";
    return {...item,frequencySignal:signal(item.frequencyZ,frequencyScore,[`Observed ${item.totalCount}; expected ${round2(item.expectedCount)}`,`Weighted frequency ${round2(item.weightedFrequency)}`],supportConfidence),momentumSignal:signal(item.momentum.ratio10vs30,momentumScore,[`${item.momentum.label}: 10/30 ratio ${round2(item.momentum.ratio10vs30)}`],supportConfidence),gapSignal:signal(item.gap.gapPercentile??50,gapScore,[`Gap percentile ${item.gap.gapPercentile===null?"N/A":`${round2(item.gap.gapPercentile)}%`}`,`Completed gaps ${item.gap.completedGapCount}; ${item.gap.gapCensored?"censored":"observed in window"}`],item.gap.completedGapCount>=10?supportConfidence:"LOW"),associationSignal:signal(associationRaw[index],associationScores[index],[`Supported pair-lift signal ${round2(associationRaw[index])}`],associationRaw[index]?supportConfidence:"LOW")};
  });
  for(const key of ["frequencySignal","momentumSignal","gapSignal","associationSignal"] as const){const orderedSignals=[...scored].sort((a,b)=>b[key].normalizedScore-a[key].normalizedScore||a.number-b.number);let rank=0,previous:number|undefined;const values=orderedSignals.map(item=>item[key].normalizedScore);orderedSignals.forEach(item=>{if(item[key].normalizedScore!==previous){rank++;previous=item[key].normalizedScore;}item[key].rank=rank;item[key].percentileRank=round2(percentileRank(values,item[key].normalizedScore)??50);});}
  const consensusWeights=settings.consensusWeights??{frequency:25,momentum:25,gap:25,association:25};
  const componentTop10=(["frequencySignal","momentumSignal","gapSignal","associationSignal"] as const).map(key=>exactTopNumbers(scored.map(item=>({number:item.number,score:item[key].normalizedScore})),10));
  const singleWeights=settings.singleScoreWeights??{frequency:35,zScore:25,momentum:20,gap:20};
  const stateScore:Record<NumberState,number>={NEUTRAL:100,HOT:70,COOL:40,DUE:0,DROUGHT:0};
  const withConsensus=scored.map((item,index)=>{const components=[item.frequencySignal,item.momentumSignal,item.gapSignal,item.associationSignal];const consensus=weightedAverage(components.map(component=>component.percentileRank),[consensusWeights.frequency,consensusWeights.momentum,consensusWeights.gap,consensusWeights.association]);const agreement=componentTop10.filter(top=>top.has(item.number)).length;const confidence:Confidence=agreement>=3&&totalDraws>=100&&item.associationSignal.confidence!=="LOW"?"HIGH":agreement>=2&&totalDraws>=50?"MEDIUM":"LOW";const technicalScore=weightedAverage([weightedScores[index],clamp(50+15*item.frequencyZ),item.momentumSignal.normalizedScore,item.gapSignal.normalizedScore],[singleWeights.frequency,singleWeights.zScore,singleWeights.momentum,singleWeights.gap]);const pickScore=round2(.35*chanceAdjustedSubsetScore(item.totalCount,totalDraws,1,maxNumber,ordered[0]?.numbers.length??6)+.30*item.gap.gapScore+.35*stateScore[item.state]);return {...item,pickScore,models:{frequency:item.frequencySignal,momentum:item.momentumSignal,gap:item.gapSignal,association:item.associationSignal,consensus:signal(consensus,consensus,[`${agreement}/4 component models place this number in the Top 10`],confidence)},modelAgreement:agreement,confidence,technicalScore:round2(technicalScore),rank:0};});
  const ranked=[...withConsensus].sort((a,b)=>b.technicalScore-a.technicalScore||a.number-b.number);
  let consensusRank=0,previousConsensus:number|undefined;const consensusValues=ranked.map(item=>item.technicalScore);
  ranked.forEach(item=>{if(item.technicalScore!==previousConsensus){consensusRank++;previousConsensus=item.technicalScore;}item.rank=consensusRank;item.models.consensus.rank=consensusRank;item.models.consensus.percentileRank=round2(percentileRank(consensusValues,item.technicalScore)??50);});
  return withConsensus;
}

export function exactTopNumbers(items:{number:number;score:number}[],count:number){
  return new Set([...items].sort((a,b)=>b.score-a.score||a.number-b.number).slice(0,count).map(item=>item.number));
}

export function calculatePairs(draws: Draw[],maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET]): PairStats[] {
  const insideSet=new Set(insideNumbers);
  const result: PairStats[] = [];
  const recent=draws.slice(-30);
  const counts=Array(maxNumber+1).fill(0),recentCounts=Array(maxNumber+1).fill(0);
  const pairCounts=Array.from({length:maxNumber+1},()=>Array(maxNumber+1).fill(0)),recentPairCounts=Array.from({length:maxNumber+1},()=>Array(maxNumber+1).fill(0));
  const accumulate=(source:Draw[],singles:number[],matrix:number[][])=>source.forEach(draw=>{draw.numbers.forEach(number=>singles[number]++);combinations([...draw.numbers],2).forEach(([a,b])=>{matrix[a][b]++;matrix[b][a]++;});});
  accumulate(draws,counts,pairCounts);accumulate(recent,recentCounts,recentPairCounts);
  for (let a = 1; a < maxNumber; a++) for (let b = a + 1; b <= maxNumber; b++) {
    const count = pairCounts[a][b];
    const countA=counts[a],countB=counts[b];
    const expected=draws.length?(countA/draws.length)*(countB/draws.length):0;
    const recentCount=recentPairCounts[a][b];
    const recentA=recentCounts[a],recentB=recentCounts[b];
    const recentExpected=recent.length?(recentA/recent.length)*(recentB/recent.length):0;
    result.push({ a, b, key: `${pad(a)}-${pad(b)}`, count, rate: draws.length ? count / draws.length : 0, lift:expected?(count/draws.length)/expected:0,recentCount,recentLift:recentExpected?(recentCount/recent.length)/recentExpected:0,confidence:pairConfidence(count), insideCount: Number(insideSet.has(a)) + Number(insideSet.has(b)), outsideCount: Number(!insideSet.has(a)) + Number(!insideSet.has(b)), evenCount: Number(a % 2 === 0) + Number(b % 2 === 0), oddCount: Number(a % 2 !== 0) + Number(b % 2 !== 0), rank: 0 });
  }
  result.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).forEach((x, i) => x.rank = i + 1);
  return result;
}

export function calculateTriples(draws: Draw[],maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET]): TripleStats[] {
  const insideSet=new Set(insideNumbers);
  const map = new Map<string, { numbers: [number, number, number]; count: number }>();
  draws.forEach(draw => combinations([...draw.numbers], 3).forEach(nums => {
    const sorted = nums.sort((a, b) => a - b) as [number, number, number];
    const key = sorted.map(pad).join("-");
    const prev = map.get(key);
    map.set(key, { numbers: sorted, count: (prev?.count ?? 0) + 1 });
  }));
  const counts=new Map(Array.from({length:maxNumber},(_,i)=>[i+1,draws.filter(draw=>draw.numbers.includes(i+1)).length]));
  return [...map.entries()].map(([key, item]) => {const expected=item.numbers.reduce((product,n)=>product*((counts.get(n)??0)/Math.max(1,draws.length)),1);return { ...item, key, rate: draws.length ? item.count / draws.length : 0,lift:expected?(item.count/draws.length)/expected:0,confidence:pairConfidence(item.count), insideCount: item.numbers.filter(n => insideSet.has(n)).length, outsideCount: item.numbers.filter(n => !insideSet.has(n)).length, evenCount: item.numbers.filter(n => n % 2 === 0).length, oddCount: item.numbers.filter(n => n % 2 !== 0).length, rank: 0 };}).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).map((x, i) => ({ ...x, rank: i + 1 }));
}

export type CandidateCooldown={numbers:ReadonlySet<number>;mode:"hard"|"soft";softPenalty:number;fallback?:boolean};
export function buildRecentDrawCooldownSet(draws:Draw[],options:AnalysisSettings["recentDrawCooldown"]):Set<number>{
  if(!options.enabled)return new Set();
  const count=Number.isInteger(options.draws)?Math.max(1,options.draws):1;
  return new Set([...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(-count).flatMap(draw=>options.includeBonus&&draw.bonus!==undefined?[...draw.numbers,draw.bonus]:draw.numbers));
}

export function scoreCandidateCombinations(numberSets:number[][],singles:SingleNumberStats[],pairs:PairStats[],triples:TripleStats[],settings:AnalysisSettings,history:Draw[]=[],insideNumbers:readonly number[]= [...INSIDE_SET],structureHistory:Draw[]=history,cooldown?:CandidateCooldown):CandidateCombination[]{
  const maxNumber=singles.length||45;
  const drawSize=history[0]?.numbers.length??numberSets[0]?.length??6,insideSet=new Set(insideNumbers);
  const observedDraws=history.length||singles.reduce((sum,item)=>sum+item.totalCount,0)/drawSize;
  const subsetCache=new Map<string,number>();
  const subsetScore=(observed:number,size:1|2|3)=>{const key=`${size}:${observed}`;if(!subsetCache.has(key))subsetCache.set(key,chanceAdjustedSubsetScore(observed,observedDraws,size,maxNumber,drawSize));return subsetCache.get(key)!;};
  const singleMap = new Map(singles.map(x => [x.number,{
    chance:subsetScore(x.totalCount,1),
    pick:clamp(x.pickScore-(cooldown?.mode==="soft"&&cooldown.numbers.has(x.number)?cooldown.softPenalty:0)),
  }]));
  const pairMap = new Map(pairs.map(x => [x.key, x]));
  const tripleMap = new Map(triples.map(x => [x.key, x]));
  const w = settings.comboWeightsV2??{single:38,pair:28,gap:18,structure:10,novelty:6};
  const historySets=history.map(draw=>new Set(draw.numbers));
  const structures=structureHistory.map(draw=>calculateDrawStructure(draw,maxNumber,insideNumbers));
  const structureStats={mean:mean(structures.map(item=>item.sum)),stdDev:stdDev(structures.map(item=>item.sum))};
  const parityCounts=new Map<number,number>(),insideCounts=new Map<number,number>();
  structures.forEach(item=>{parityCounts.set(item.evenCount,(parityCounts.get(item.evenCount)??0)+1);insideCounts.set(item.insideCount,(insideCounts.get(item.insideCount)??0)+1);});
  return numberSets.map(numbers => {
    const total = numbers.reduce((a, b) => a + b, 0);
    const root = digitalRoot(total);
    const evenCount = numbers.filter(n => n % 2 === 0).length;
    const insideCount = numbers.filter(n => insideSet.has(n)).length;
    const candidatePairs=combinations(numbers,2),candidateTriples=combinations(numbers,3);
    const pairScore = candidatePairs.reduce((sum, pair) => {
      const stat=pairMap.get([...pair].sort((a,b)=>a-b).map(pad).join("-"));
      return sum+subsetScore(stat?.count??0,2);
    }, 0) / candidatePairs.length;
    const tripleScore = candidateTriples.reduce((sum, triple) => {
      const stat=tripleMap.get([...triple].sort((a,b)=>a-b).map(pad).join("-"));
      return sum+subsetScore(stat?.count??0,3);
    }, 0) / candidateTriples.length;
    const singleScore = numbers.reduce((sum, n) => {
      const item=singleMap.get(n);
      return sum+(item?.chance===undefined?50:.55*item.chance+.45*item.pick);
    }, 0) / drawSize;
    const gapScore=numbers.reduce((sum,n)=>sum+(singles[n-1]?.gap.gapScore??50),0)/drawSize;
    const sumScore=structures.length?(structureStats.stdDev?100*Math.exp(-.5*((total-structureStats.mean)/structureStats.stdDev)**2):Number(total===structureStats.mean)*100):50;
    const parityScore=structures.length?100*(parityCounts.get(evenCount)??0)/structures.length:50;
    const insideScore=structures.length?100*(insideCounts.get(insideCount)??0)/structures.length:50;
    const structureScore=.5*sumScore+.3*parityScore+.2*insideScore;
    const valid = total >= settings.minTotal && settings.allowedDigitalRoots.includes(root) && settings.allowedParity.includes(`${evenCount}/${drawSize-evenCount}`) && settings.allowedInsideOutside.includes(`${insideCount}/${drawSize-insideCount}`);
    const maxHistoricalOverlap=historySets.length?Math.max(...historySets.map(draw=>numbers.reduce((count,number)=>count+Number(draw.has(number)),0))):0;
    const noveltyScore=history.length?clamp(100-.85*maxHistoricalOverlap/drawSize*100):100;
    const proposalScore=weightedAverage([singleScore,pairScore,gapScore,structureScore,noveltyScore],[w.single,w.pair,w.gap,w.structure,w.novelty]);
    const totalScore=calibrateProposalScore(proposalScore);
    const averagePairSupport=candidatePairs.reduce((sum,pair)=>sum+(pairMap.get([...pair].sort((a,b)=>a-b).map(pad).join("-"))?.count??0),0)/Math.max(1,candidatePairs.length);
    const dataSupport:Confidence=observedDraws>=80&&averagePairSupport>=4?"HIGH":observedDraws>=40?"MEDIUM":"LOW";
    const confidence:Confidence=dataSupport;
    return { numbers, total, digitalRoot: root, evenCount, oddCount: drawSize-evenCount, insideCount, outsideCount: drawSize-insideCount, singleScore, pairScore, gapScore, tripleScore, structureScore, noveltyScore,maxHistoricalOverlap,totalScore,confidence,dataSupport,valid };
  });
}

export function calculateScoreTimeline(draws:Draw[],settings:AnalysisSettings,maxNumber=45,targetDrawIds?:string[],trainingWindow=50,insideNumbers:readonly number[]= [...INSIDE_SET]){
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!ordered.length)return [];
  const targets=targetDrawIds?new Set(targetDrawIds):undefined;
  const points=ordered.flatMap((draw,index)=>{
    if(index<trainingWindow||(targets&&!targets.has(draw.id)))return [];
    const history=ordered.slice(index-trainingWindow,index);
    const singles=calculateSingles(history,settings,maxNumber,insideNumbers);
    const pairs=calculatePairs(history,maxNumber,insideNumbers);
    const triples=calculateTriples(history,maxNumber,insideNumbers);
    const [score]=scoreCandidateCombinations([draw.numbers],singles,pairs,triples,settings,history,insideNumbers,history);
    return {id:draw.id,date:draw.date,single:round2(score.singleScore),pair:round2(score.pairScore),triple:round2(score.tripleScore),gap:round2(score.gapScore),structure:round2(score.structureScore),novelty:round2(score.noveltyScore),total:round2(score.totalScore)};
  });
  const movingAverage=(key:"single"|"pair"|"triple"|"structure"|"total",index:number)=>{
    const window=points.slice(Math.max(0,index-19),index+1);
    return round2(mean(window.map(point=>point[key])));
  };
  return points.map((point,index)=>({
    ...point,
    singleMa20:movingAverage("single",index),
    pairMa20:movingAverage("pair",index),
    tripleMa20:movingAverage("triple",index),
    structureMa20:movingAverage("structure",index),
    totalMa20:movingAverage("total",index),
  }));
}

export function buildCandidateNumberPool(singles:SingleNumberStats[],settings:AnalysisSettings,requestedCount=settings.topCombinationCount,drawSize=singles.length===35?5:6,cooldown?:CandidateCooldown){
  const maxNumber=singles.length||45,totalDraws=singles.reduce((sum,item)=>sum+item.totalCount,0)/drawSize;
  const minimumCount=totalDraws>=50?3:2;
  const eligible=singles.filter(item=>["NEUTRAL","HOT","COOL"].includes(item.state)&&item.totalCount>=minimumCount&&totalDraws>0&&item.totalCount/totalDraws/(drawSize/maxNumber)>=.9&&!(cooldown?.mode==="hard"&&cooldown.numbers.has(item.number)));
  const pickScore=(item:SingleNumberStats)=>item.pickScore-(cooldown?.mode==="soft"&&cooldown.numbers.has(item.number)?cooldown.softPenalty:0);
  const poolSize=Math.min(maxNumber,settings.candidatePoolSize);
  const insideRatio=eligible.length?eligible.filter(item=>item.inside).length/eligible.length:.5;
  const selected:SingleNumberStats[]=[];
  const addGroup=(group:SingleNumberStats[],count:number)=>{
    const remaining=group.filter(item=>!selected.includes(item));
    const insideCount=Math.min(Math.round(count*insideRatio),remaining.filter(item=>item.inside).length);
    const inside=remaining.filter(item=>item.inside).sort((a,b)=>pickScore(b)-pickScore(a)||a.number-b.number).slice(0,insideCount);
    const outside=remaining.filter(item=>!item.inside).sort((a,b)=>pickScore(b)-pickScore(a)||a.number-b.number).slice(0,count-inside.length);
    selected.push(...inside,...outside);
    const missing=count-inside.length-outside.length;
    if(missing)selected.push(...remaining.filter(item=>!selected.includes(item)).sort((a,b)=>pickScore(b)-pickScore(a)||a.number-b.number).slice(0,missing));
  };
  const states=["NEUTRAL","HOT","COOL"] as const;
  const quotas=[Math.round(poolSize*.5),Math.round(poolSize*.3),poolSize-Math.round(poolSize*.5)-Math.round(poolSize*.3)];
  states.forEach((state,index)=>addGroup(eligible.filter(item=>item.state===state).sort((a,b)=>pickScore(b)-pickScore(a)||a.number-b.number),quotas[index]));
  for(const state of ["NEUTRAL","HOT","COOL"] as const){
    if(selected.length>=poolSize)break;
    const remaining=eligible.filter(item=>item.state===state&&!selected.includes(item)).sort((a,b)=>pickScore(b)-pickScore(a)||a.number-b.number);
    selected.push(...remaining.slice(0,poolSize-selected.length));
  }
  return selected.map(item=>item.number).sort((a,b)=>a-b);
}

export function generateCandidateUniverse(singles: SingleNumberStats[], pairs: PairStats[], triples: TripleStats[], settings: AnalysisSettings, history:Draw[]=[],insideNumbers:readonly number[]= [...INSIDE_SET],structureHistory:Draw[]=history,requestedCount=settings.topCombinationCount,cooldown?:CandidateCooldown): CandidateCombination[] {
  const maxNumber=singles.length||45;
  const drawSize=history[0]?.numbers.length??(maxNumber===35?5:6),insideSet=new Set(insideNumbers);
  const pool=buildCandidateNumberPool(singles,settings,requestedCount,drawSize,cooldown);
  const allowed=(candidate:CandidateCombination)=>candidate.valid&&!(cooldown?.mode==="hard"&&candidate.numbers.some(number=>cooldown.numbers.has(number)));
  const candidates=scoreCandidateCombinations(combinations(pool,drawSize),singles,pairs,triples,settings,history,insideNumbers,structureHistory,cooldown).filter(allowed).sort((a,b)=>b.totalScore-a.totalScore);
  const rootsPresent=new Set(candidates.map(candidate=>candidate.digitalRoot));
  const missingRoots=settings.allowedDigitalRoots.filter(root=>!rootsPresent.has(root));
  const parityPresent=new Set(candidates.map(candidate=>`${candidate.evenCount}/${candidate.oddCount}`));
  const missingParity=settings.allowedParity.filter(parity=>!parityPresent.has(parity));
  const rootAlternatives:number[][]=[];
  const candidateKeys=new Set(candidates.map(item=>[...item.numbers].sort((a,b)=>a-b).join("-")));
  const targetCounts=new Map<string,number>([
    ...missingRoots.map(root=>[`root:${root}`,0] as [string,number]),
    ...missingParity.map(parity=>[`parity:${parity}`,0] as [string,number]),
  ]);
  if(targetCounts.size){
    for(const source of candidates.slice(0,60)){
      for(let index=0;index<source.numbers.length;index++) for(let number=1;number<=maxNumber;number++){
        if(source.numbers.includes(number)||!pool.includes(number))continue;
        const numbers=[...source.numbers];
        numbers[index]=number;
        const total=numbers.reduce((sum,value)=>sum+value,0);
        const root=digitalRoot(total);
        const rootKey=`root:${root}`;
        if(!settings.allowedDigitalRoots.includes(root))continue;
        const even=numbers.filter(value=>value%2===0).length;
        const parity=`${even}/${drawSize-even}`;
        const parityKey=`parity:${parity}`;
        const targetKeys=[rootKey,parityKey].filter(key=>targetCounts.has(key)&&(targetCounts.get(key)??0)<12);
        if(!targetKeys.length)continue;
        const inside=numbers.filter(value=>insideSet.has(value)).length;
        if(total<settings.minTotal||!settings.allowedParity.includes(parity)||!settings.allowedInsideOutside.includes(`${inside}/${drawSize-inside}`))continue;
        const key=[...numbers].sort((a,b)=>a-b).join("-");
        if(candidateKeys.has(key))continue;
        candidateKeys.add(key);
        rootAlternatives.push([...numbers].sort((a,b)=>a-b));
        targetKeys.forEach(target=>targetCounts.set(target,(targetCounts.get(target)??0)+1));
      }
      if([...targetCounts.values()].every(count=>count>=12))break;
    }
  }
  const alternatives=rootAlternatives.length?scoreCandidateCombinations(rootAlternatives,singles,pairs,triples,settings,history,insideNumbers,structureHistory,cooldown).filter(allowed):[];
  return [...candidates,...alternatives].sort((a,b)=>b.totalScore-a.totalScore||a.numbers.join("-").localeCompare(b.numbers.join("-"))).map((item,index)=>({...item,candidateRank:index+1}));
}

export function selectPortfolio(allCandidates:CandidateCombination[],settings:AnalysisSettings,count=Math.max(20,settings.topCombinationCount),allowRelaxedOverlap=true):CandidateCombination[]{
  const candidates=[...allCandidates].sort((a,b)=>b.totalScore-a.totalScore||a.numbers.join("-").localeCompare(b.numbers.join("-")));
  const selected:CandidateCombination[]=[];
  const nextLimit=()=>Math.min(settings.maxCombinationOverlap,selected.length<5?2:selected.length<10?3:settings.maxCombinationOverlap);
  const feasible=(filter:(candidate:CandidateCombination)=>boolean=()=>true)=>candidates.filter(candidate=>!selected.includes(candidate)&&filter(candidate)&&selected.every(existing=>candidate.numbers.filter(number=>existing.numbers.includes(number)).length<=nextLimit()));
  const pickByUtility=(items:CandidateCombination[])=>{
    const used=new Set(selected.flatMap(item=>item.numbers));
    return items.reduce((best,candidate)=>{
      const utility=candidate.totalScore+10*candidate.numbers.filter(number=>!used.has(number)).length-9*mean(selected.map(existing=>candidate.numbers.filter(number=>existing.numbers.includes(number)).length));
      const bestUtility=best.totalScore+10*best.numbers.filter(number=>!used.has(number)).length-9*mean(selected.map(existing=>best.numbers.filter(number=>existing.numbers.includes(number)).length));
      return utility>bestUtility?candidate:best;
    });
  };
  if(count>0&&candidates.length)selected.push(candidates[0]);
  for(const parity of settings.allowedParity){
    if(selected.length>=count)break;
    if(selected.some(item=>`${item.evenCount}/${item.oddCount}`===parity))continue;
    const options=feasible(item=>`${item.evenCount}/${item.oddCount}`===parity);
    if(options.length)selected.push(pickByUtility(options));
  }
  while(selected.length<count){
    const options=feasible();
    if(!options.length)break;
    selected.push(pickByUtility(options));
  }
  while(selected.length<count){
    const options=candidates.filter(candidate=>!selected.includes(candidate)&&selected.every(existing=>candidate.numbers.filter(number=>existing.numbers.includes(number)).length<=settings.maxCombinationOverlap));
    if(!options.length)break;
    selected.push(pickByUtility(options));
  }
  if(allowRelaxedOverlap)while(selected.length<count){
    const options=candidates.filter(candidate=>!selected.includes(candidate)&&selected.every(existing=>candidate.numbers.filter(number=>existing.numbers.includes(number)).length<=settings.maxCombinationOverlap+1));
    if(!options.length)break;
    selected.push({...pickByUtility(options),selectionReason:"relaxed-overlap"});
  }
  return selected.map((item,index)=>({...item,rank:index+1}));
}

export function selectExperimentalPowerPortfolio(allCandidates:CandidateCombination[],singles:SingleNumberStats[],pairs:PairStats[],triples:TripleStats[],settings:AnalysisSettings,history:Draw[],count=50,structureHistory:Draw[]=history,insideNumbers:readonly number[]= [...INSIDE_SET],allowRelaxedOverlap=true,cooldown?:CandidateCooldown):CandidateCombination[]{
  const firstFive=selectPortfolio(allCandidates,settings,50,allowRelaxedOverlap).slice(0,5).map(item=>({...item,selectionReason:"score" as const,selectionScore:round2(clamp(item.totalScore))}));
  if(!firstFive.length)return [];
  const experimentalSettings={...settings,allowedInsideOutside:[...new Set([...settings.allowedInsideOutside,"2/4"])]};
  const key=(numbers:number[])=>numbers.join("-");
  const maxNumber=singles.length||55,drawSize=history[0]?.numbers.length??6;
  const pool=buildCandidateNumberPool(singles,settings,count,drawSize,cooldown);
  const wide=scoreCandidateCombinations(combinations(pool,drawSize),singles,pairs,triples,experimentalSettings,history,insideNumbers,structureHistory,cooldown).filter(item=>item.valid&&item.insideCount===2&&!(cooldown?.mode==="hard"&&item.numbers.some(number=>cooldown.numbers.has(number))));
  const candidates=[...allCandidates,...wide];
  const selected:CandidateCombination[]=[...firstFive];
  const selectedKeys=new Set(selected.map(item=>key(item.numbers)));
  const numberCounts=Array(maxNumber+1).fill(0);
  const add=(ticket:CandidateCombination)=>ticket.numbers.forEach(number=>numberCounts[number]++);
  selected.forEach(add);
  if(allowRelaxedOverlap)while(selected.length<count){
    let best:CandidateCombination|undefined,bestScore=-Infinity;
    for(const candidate of candidates){
      if(selectedKeys.has(key(candidate.numbers))||selected.some(ticket=>candidate.numbers.filter(number=>ticket.numbers.includes(number)).length>settings.maxCombinationOverlap))continue;
      const newCount=candidate.numbers.filter(number=>numberCounts[number]===0).length;
      const diversity=candidate.numbers.reduce((sum,number)=>sum+1/(1+numberCounts[number]),0)/drawSize;
      const score=80*(newCount/drawSize)+20*diversity;
      if(score>bestScore||score===bestScore&&best&&(candidate.totalScore>best.totalScore||candidate.totalScore===best.totalScore&&key(candidate.numbers)<key(best.numbers))){best=candidate;bestScore=score;}
    }
    if(!best)break;
    const chosen={...best,rank:selected.length+1,selectionReason:"coverage" as const,selectionScore:round2(clamp(bestScore))};
    selected.push(chosen);selectedKeys.add(key(chosen.numbers));add(chosen);
  }
  if(allowRelaxedOverlap)while(selected.length<count){
    let best:CandidateCombination|undefined,bestScore=-Infinity;
    for(const candidate of candidates){
      if(selectedKeys.has(key(candidate.numbers))||selected.some(ticket=>candidate.numbers.filter(number=>ticket.numbers.includes(number)).length>settings.maxCombinationOverlap+1))continue;
      const newCount=candidate.numbers.filter(number=>numberCounts[number]===0).length;
      const diversity=candidate.numbers.reduce((sum,number)=>sum+1/(1+numberCounts[number]),0)/drawSize;
      const score=80*(newCount/drawSize)+20*diversity;
      if(score>bestScore||score===bestScore&&best&&(candidate.totalScore>best.totalScore||candidate.totalScore===best.totalScore&&key(candidate.numbers)<key(best.numbers))){best=candidate;bestScore=score;}
    }
    if(!best)break;
    const chosen={...best,rank:selected.length+1,selectionReason:"relaxed-overlap" as const,selectionScore:round2(clamp(bestScore))};
    selected.push(chosen);selectedKeys.add(key(chosen.numbers));add(chosen);
  }
  return selected.map((item,index)=>({...item,rank:index+1}));
}

export function generateCandidates(singles: SingleNumberStats[], pairs: PairStats[], triples: TripleStats[], settings: AnalysisSettings, history:Draw[]=[],insideNumbers:readonly number[]= [...INSIDE_SET],structureHistory:Draw[]=history): CandidateCombination[] {
  const count=Math.max(20,settings.topCombinationCount),universe=generateCandidateUniverse(singles,pairs,triples,settings,history,insideNumbers,structureHistory,count);
  let selected=selectPortfolio(universe,settings,count,false);
  if(selected.length<count){const expanded=generateCandidateUniverse(singles,pairs,triples,{...settings,candidatePoolSize:Math.min(singles.length,settings.candidatePoolSize+4)},history,insideNumbers,structureHistory,count);selected=selectPortfolio([...universe,...expanded],settings,count,true);}
  return selected;
}

export type FilteredCombination={proposal:CandidateCombination;filter:CandidateCombination;mainRank:number|null;filteredRank:number};
export function selectFilteredPortfolio(universe:CandidateCombination[],filterScores:CandidateCombination[],main:CandidateCombination[],ranges:CombinationScoreRanges,settings:AnalysisSettings,count:number,sort:"proposal"|"filter"="proposal"){
  if(universe.length!==filterScores.length)throw new RangeError("Candidate and filter score counts differ");
  const key=(numbers:number[])=>[...numbers].sort((a,b)=>a-b).join("-");
  const mainRanks=new Map(main.map(item=>[key(item.numbers),item.rank??null]));
  const passing=universe.map((proposal,index)=>({proposal,filter:filterScores[index]})).filter(item=>filterCombinationsByScores([item.filter],ranges).length);
  passing.sort((a,b)=>(sort==="filter"?b.filter.totalScore-a.filter.totalScore:b.proposal.totalScore-a.proposal.totalScore)||key(a.proposal.numbers).localeCompare(key(b.proposal.numbers)));
  const rows:FilteredCombination[]=[];
  for(const item of passing){
    if(rows.every(existing=>item.proposal.numbers.filter(number=>existing.proposal.numbers.includes(number)).length<=settings.maxCombinationOverlap))rows.push({...item,mainRank:mainRanks.get(key(item.proposal.numbers))??null,filteredRank:rows.length+1});
    if(rows.length>=count)break;
  }
  return {passing:passing.length,rows};
}

export function calculatePortfolioCoverage(portfolio:CandidateCombination[],maxNumber:number){
  const numberCounts=Array.from({length:maxNumber},(_,index)=>({number:index+1,count:portfolio.filter(ticket=>ticket.numbers.includes(index+1)).length}));
  const unique=(size:number)=>new Set(portfolio.flatMap(ticket=>combinations([...ticket.numbers].sort((a,b)=>a-b),size).map(part=>part.join("-")))).size;
  const tripleCounts=new Map<string,number>();
  portfolio.forEach(ticket=>combinations([...ticket.numbers].sort((a,b)=>a-b),3).forEach(triple=>{const key=triple.map(pad).join("-");tripleCounts.set(key,(tripleCounts.get(key)??0)+1);}));
  const mostRepeatedTriple=[...tripleCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
  return {ticketCount:portfolio.length,uniqueNumbers:numberCounts.filter(item=>item.count>0).length,uniquePairs:unique(2),uniqueTriples:unique(3),mostRepeatedTriple:mostRepeatedTriple?{numbers:mostRepeatedTriple[0],ticketCount:mostRepeatedTriple[1]}:null,numberCounts};
}

export function backtest(draws: Draw[], settings: AnalysisSettings, count = 12,maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET]) {
  const distribution = [0,0,0,0,0,0,0];
  let totalMatches = 0; let best = 0; let tests = 0;
  for (let i = Math.max(10, draws.length - count); i < draws.length; i++) {
    const history = draws.slice(0, i);
    const predictions = generateCandidates(calculateSingles(history,settings,maxNumber,insideNumbers),calculatePairs(history,maxNumber,insideNumbers),calculateTriples(history,maxNumber,insideNumbers),settings,history,insideNumbers).slice(0,5);
    const match = predictions.reduce((m, p) => Math.max(m, p.numbers.filter(n => draws[i].numbers.includes(n)).length), 0);
    distribution[match]++; totalMatches += match; best = Math.max(best, match); tests++;
  }
  return { distribution, average: tests ? totalMatches / tests : 0, best, tests };
}

export type BacktestRangeOptions={fromDate:string;toDate:string;trainingDraws:number;predictionCount:number;maxNumber?:number;insideNumbers?:readonly number[];manualProposedSets?:number[][];powerSuggestionMode?:PowerSuggestionMode};
export type BacktestPrediction=CandidateCombination&{count:number;rate:number;matches:number};
export type BacktestResultRow={targetId:string;date:string;predictions:BacktestPrediction[];actual:number[];bestMatches:number};

export function getBacktestTrainingWindows(draws:Draw[],fromDate:string,toDate:string){
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const target=ordered.filter(draw=>draw.date>=fromDate&&draw.date<=toDate).at(-1);
  const targetIndex=target?ordered.indexOf(target):-1;
  const priorDraws=Math.max(0,targetIndex);
  const windows=[30,50,100].filter(window=>priorDraws>=window);
  const targets=ordered.map((draw,index)=>({draw,index})).filter(({draw})=>draw.date>=fromDate&&draw.date<=toDate);
  const rolling=Object.fromEntries([30,50,100].map(window=>[window,{eligibleTargetCount:targets.filter(({index})=>index>=window).length,skippedTrainingCount:targets.filter(({index})=>index<window).length}]));
  return {priorDraws,windows,rolling};
}

export function backtestRange(draws:Draw[],settings:AnalysisSettings,options:BacktestRangeOptions){
  const distribution=[0,0,0,0,0,0,0];
  const rows:BacktestResultRow[]=[];
  let totalMatches=0,best=0;
  const trainingDraws=Math.max(10,options.trainingDraws);
  const predictionCount=Math.max(1,options.predictionCount);
  const maxNumber=options.maxNumber??45;
  const insideNumbers=options.insideNumbers??[...INSIDE_SET];
  const evaluate=(history:Draw[],actual:number[],targetId:string,date:string,manualProposedSets?:number[][],structureHistory:Draw[]=history)=>{
    const singles=calculateSingles(history,settings,maxNumber,insideNumbers);
    const pairs=calculatePairs(history,maxNumber,insideNumbers);
    const triples=calculateTriples(history,maxNumber,insideNumbers);
    let candidates:CandidateCombination[];
    if(manualProposedSets?.length)candidates=scoreCandidateCombinations(manualProposedSets,singles,pairs,triples,settings,history,insideNumbers,structureHistory);
    else if(options.powerSuggestionMode==="experimental"&&maxNumber===55){
      const universe=generateCandidateUniverse(singles,pairs,triples,settings,history,insideNumbers,structureHistory,predictionCount);
      candidates=selectExperimentalPowerPortfolio(universe,singles,pairs,triples,settings,history,predictionCount,structureHistory,insideNumbers,false);
      if(candidates.length<predictionCount){const expanded=generateCandidateUniverse(singles,pairs,triples,{...settings,candidatePoolSize:Math.min(maxNumber,settings.candidatePoolSize+4)},history,insideNumbers,structureHistory,predictionCount);candidates=selectExperimentalPowerPortfolio([...universe,...expanded],singles,pairs,triples,settings,history,predictionCount,structureHistory,insideNumbers,true);}
    }else candidates=generateCandidates(singles,pairs,triples,settings,history,insideNumbers,structureHistory).slice(0,predictionCount);
    const predictions:BacktestPrediction[]=candidates.map(candidate=>{
      const key=candidate.numbers.map(pad).join("-");
      const count=history.filter(draw=>draw.numbers.map(pad).join("-")===key).length;
      return {...candidate,count,rate:count/history.length,matches:candidate.numbers.filter(number=>actual.includes(number)).length};
    });
    const bestMatches=predictions.reduce((current,prediction)=>Math.max(current,prediction.matches),0);
    distribution[bestMatches]++;
    totalMatches+=bestMatches;
    best=Math.max(best,bestMatches);
    rows.push({targetId,date,predictions,actual,bestMatches});
  };
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const range=ordered.filter(draw=>draw.date>=options.fromDate&&draw.date<=options.toDate);
  const manualProposedSets=options.manualProposedSets;
  const targets=range.slice(-1);
  targets.forEach(target=>{
    const targetIndex=ordered.indexOf(target);
    const history=ordered.slice(Math.max(0,targetIndex-trainingDraws),targetIndex);
    if(history.length===trainingDraws)evaluate(history,target.numbers,target.id,target.date,manualProposedSets,ordered.slice(0,targetIndex));
  });
  return {distribution,average:rows.length?totalMatches/rows.length:0,best,tests:rows.length,rows,skippedTrainingCount:targets.length-rows.length,trainingWindow:trainingDraws};
}

export function runPortfolioRollingBacktest(draws:Draw[],settings:AnalysisSettings,options:{fromDate:string;toDate:string;predictionCount:5|10|20;maxNumber:number;insideNumbers?:readonly number[];trainingDraws?:number;powerSuggestionMode?:PowerSuggestionMode}){
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const window=options.trainingDraws??50;
  const distribution=[0,0,0,0,0,0,0];
  const rows:{targetId:string;date:string;bestMatches:number;ticketCount:number}[]=[];
  let skippedTrainingCount=0;
  for(let index=0;index<ordered.length;index++){
    const target=ordered[index];
    if(target.date<options.fromDate||target.date>options.toDate)continue;
    if(index<window){skippedTrainingCount++;continue;}
    const training=ordered.slice(index-window,index);
    const insideNumbers=options.insideNumbers??[...INSIDE_SET];
    const singles=calculateSingles(training,settings,options.maxNumber,insideNumbers);
    const pairs=calculatePairs(training,options.maxNumber,insideNumbers);
    const triples=calculateTriples(training,options.maxNumber,insideNumbers);
    const structureHistory=ordered.slice(0,index);
    const universe=generateCandidateUniverse(singles,pairs,triples,settings,training,insideNumbers,structureHistory,options.predictionCount);
    let portfolio=options.powerSuggestionMode==="experimental"&&options.maxNumber===55?selectExperimentalPowerPortfolio(universe,singles,pairs,triples,settings,training,options.predictionCount,structureHistory,insideNumbers,false):selectPortfolio(universe,settings,options.predictionCount,false);
    if(portfolio.length<options.predictionCount){const expanded=generateCandidateUniverse(singles,pairs,triples,{...settings,candidatePoolSize:Math.min(options.maxNumber,settings.candidatePoolSize+4)},training,insideNumbers,structureHistory,options.predictionCount);const candidates=[...universe,...expanded];portfolio=options.powerSuggestionMode==="experimental"&&options.maxNumber===55?selectExperimentalPowerPortfolio(candidates,singles,pairs,triples,settings,training,options.predictionCount,structureHistory,insideNumbers,true):selectPortfolio(candidates,settings,options.predictionCount,true);}
    portfolio=portfolio.slice(0,options.predictionCount);
    const bestMatches=portfolio.reduce((best,ticket)=>Math.max(best,ticket.numbers.filter(number=>target.numbers.includes(number)).length),0);
    distribution[bestMatches]++;
    rows.push({targetId:target.id,date:target.date,bestMatches,ticketCount:portfolio.length});
  }
  const rate=(threshold:number)=>rows.length?rows.filter(row=>row.bestMatches>=threshold).length/rows.length:0;
  const wilson=(threshold:number)=>{
    const n=rows.length;if(!n)return [0,0] as const;
    const p=rate(threshold),z=1.96,denominator=1+z*z/n,center=(p+z*z/(2*n))/denominator,spread=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denominator;
    return [Math.max(0,center-spread),Math.min(1,center+spread)] as const;
  };
  return {rows,distribution,evaluatedTargetCount:rows.length,skippedTrainingCount,requestedTicketCount:options.predictionCount,minimumTicketCount:rows.length?Math.min(...rows.map(row=>row.ticketCount)):0,meanTicketCount:rows.length?mean(rows.map(row=>row.ticketCount)):0,trainingWindow:window,fromDate:options.fromDate,toDate:options.toDate,hitRates:{atLeast3:rate(3),atLeast4:rate(4),atLeast5:rate(5),six:rate(6)},confidence95:{atLeast3:wilson(3),atLeast4:wilson(4),atLeast5:wilson(5),six:wilson(6)}};
}

export function runRollingBacktest(draws:Draw[],settings:AnalysisSettings,targetCount=30,seed=645,maxNumber=45,insideNumbers:readonly number[]= [...INSIDE_SET]){
  const drawSize=draws[0]?.numbers.length??6;
  const minimum=Math.max(1,Math.min(settings.backtestMinTrainingDraws??50,draws.length-1));
  const start=Math.max(minimum,draws.length-targetCount);
  let randomState=seed>>>0;
  const random=()=>{randomState=(1664525*randomState+1013904223)>>>0;return randomState/4294967296;};
  const rows=[];
  for(let index=start;index<draws.length;index++){
    const training=draws.slice(0,index),actual=draws[index].numbers;
    const ranked=[...calculateSingles(training,settings,maxNumber,insideNumbers)].sort((a,b)=>b.technicalScore-a.technicalScore||a.number-b.number);
    const shuffled=Array.from({length:maxNumber},(_,i)=>i+1);
    for(let j=shuffled.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[shuffled[j],shuffled[k]]=[shuffled[k],shuffled[j]];}
    const positions=new Map(ranked.map((item,position)=>[item.number,position+1]));
    const actualRanks=actual.map(number=>positions.get(number)??maxNumber);
    rows.push({targetId:draws[index].id,top5:actualRanks.filter(rank=>rank<=5).length,top10:actualRanks.filter(rank=>rank<=10).length,top15:actualRanks.filter(rank=>rank<=15).length,meanActualRank:mean(actualRanks),randomTop10:actual.filter(number=>shuffled.slice(0,10).includes(number)).length});
  }
  return {rows,tests:rows.length,modelTop10HitRate:rows.length?mean(rows.map(row=>row.top10/drawSize)):0,randomTop10HitRate:rows.length?mean(rows.map(row=>row.randomTop10/drawSize)):0,meanActualRank:rows.length?mean(rows.map(row=>row.meanActualRank)):0,seed,metricsVersion:2,tieBreak:"score desc, number asc"};
}
