import { startOfMonth, subMonths } from "date-fns";
import type { AnalysisSettings, CandidateCombination, Confidence, Draw, ModelSignal, NumberState, PairStats, PeriodPreset, SingleNumberStats, TripleStats } from "./domain";
import { INSIDE_SET } from "./domain";

export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const pad = (n: number) => String(n).padStart(2, "0");
/**
 * Scores a subset's historical inclusion rate against the exact 6-of-M null.
 * Beta-prior pseudo-draws shrink sparse observations toward chance, with more
 * shrinkage for higher-order subsets. 50 is chance-level; scores are ranking
 * signals, not probabilities that a number will be drawn next.
 */
export function chanceAdjustedSubsetScore(observed:number,drawCount:number,subsetSize:1|2|3,maxNumber:number):number{
  if(drawCount<=0||maxNumber<6||subsetSize>6)return 50;
  let baseline=1;
  for(let i=0;i<subsetSize;i++)baseline*=(6-i)/(maxNumber-i);
  const strength=20*subsetSize*subsetSize;
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
export type CompactCombinationIssue={entryIndex:number;chunkIndex?:number;value:string};
export function parseCompactCombinations(input:string,maxNumber:number){
  const entries=input.split(/[,\n]+/).map(value=>value.trim()).filter(Boolean);
  const issues:CompactCombinationIssue[]=[];
  const combinations=entries.flatMap((entry,entryIndex)=>{
    const compact=entry.replace(/[\s-]+/g,"");
    if(!/^\d{12}$/.test(compact)){issues.push({entryIndex,value:entry});return [];}
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
export const variance = (values: number[]) => values.length ? mean(values.map(value => (value - mean(values)) ** 2)) : 0;
export const stdDev = (values: number[]) => Math.sqrt(variance(values));
export function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  const position = (sorted.length - 1) * clamp(q,0,1);
  const base = Math.floor(position);
  const remainder = position - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + remainder * (sorted[base + 1] - sorted[base]);
}
export const percentileRank = (values: number[], value: number) => values.length <= 1 ? 100 : 100 * values.filter(item => item < value).length / (values.length - 1);
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
  const points = ordered.map((draw, index) => {
    const window = ordered.slice(Math.max(0, index - 20), index);
    const historicalFrequency = draw.numbers.reduce(
      (total, number) => total + window.filter(item => item.numbers.includes(number)).length,
      0,
    );

    return { id: draw.id, date: draw.date, historicalFrequency };
  });

  return points.map((point, index) => ({
    ...point,
    ma20: round2(
      points
        .slice(Math.max(0, index - 19), index + 1)
        .reduce((sum, item) => sum + item.historicalFrequency, 0) / Math.min(20, index + 1),
    ),
  }));
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
export function calculateExpectedFrequencyBand(totalDraws:number,maxNumber=45){const p=6/maxNumber,expected=totalDraws*p,sigma=Math.sqrt(totalDraws*p*(1-p));return {expected,sigma,lower95:Math.max(0,expected-1.96*sigma),upper95:expected+1.96*sigma};}
export function calculateFrequencyZ(observed:number,totalDraws:number,maxNumber=45){const {expected,sigma}=calculateExpectedFrequencyBand(totalDraws,maxNumber);return zScore(observed,expected,sigma);}
const normalCdf=(value:number)=>{const sign=value<0?-1:1,x=Math.abs(value)/Math.sqrt(2),t=1/(1+.3275911*x),erf=sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+.254829592)*t*Math.exp(-x*x));return .5*(1+erf);};
export function calculateChiSquareUniformity(draws:Draw[],maxNumber=45){const expected=draws.length*6/maxNumber;const counts=Array.from({length:maxNumber},(_,i)=>draws.filter(draw=>draw.numbers.includes(i+1)).length);const chiSquare=expected?counts.reduce((sum,count)=>sum+(count-expected)**2/expected,0):0;const df=maxNumber-1;const transformed=df?((chiSquare/df)**(1/3)-(1-2/(9*df)))/Math.sqrt(2/(9*df)):0;return {chiSquare:round2(chiSquare),degreesOfFreedom:df,pValue:clamp(1-normalCdf(transformed),0,1)};}
export function calculateGapDistribution(draws:Draw[],number:number){const appearances=draws.flatMap((draw,index)=>draw.numbers.includes(number)?[index]:[]);const gaps=appearances.slice(1).map((value,index)=>value-appearances[index]-1);const currentGap=appearances.length?draws.length-1-appearances.at(-1)!:draws.length;const meanGap=mean(gaps),stdGap=stdDev(gaps);return {gaps,currentGap,meanGap,medianGap:median(gaps),minGap:gaps.length?Math.min(...gaps):0,maxGap:gaps.length?Math.max(...gaps):currentGap,stdGap,q1:quantile(gaps,.25),q3:quantile(gaps,.75),gapPercentile:percentileRank(gaps,currentGap),gapZ:zScore(currentGap,meanGap,stdGap),gapCV:meanGap?stdGap/meanGap:0};}
export function calculateTransitionMatrix(draws:Draw[],maxNumber=45){const counts=Array.from({length:maxNumber},()=>Array(maxNumber).fill(0));const eligible=Array(maxNumber).fill(0);for(let i=0;i<draws.length-1;i++)for(const a of draws[i].numbers){eligible[a-1]++;for(const b of draws[i+1].numbers)counts[a-1][b-1]++;}return {counts,eligible};}
export function calculateTransitionLift(draws:Draw[],a:number,b:number,maxNumber=45){const {counts,eligible}=calculateTransitionMatrix(draws,maxNumber);const rate=eligible[a-1]?counts[a-1][b-1]/eligible[a-1]:0;const baseline=draws.length?draws.filter(draw=>draw.numbers.includes(b)).length/draws.length:0;return baseline?rate/baseline:0;}
export function calculateDrawStructure(draw:Draw,maxNumber=45){const values=[...draw.numbers].sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0),evenCount=values.filter(n=>n%2===0).length,insideCount=values.filter(n=>INSIDE_SET.has(n)).length,lowCount=values.filter(n=>n<=Math.floor(maxNumber/2)).length;return {sum,mean:sum/6,median:median(values),min:values[0],max:values[5],spread:values[5]-values[0],evenCount,oddCount:6-evenCount,insideCount,outsideCount:6-insideCount,lowCount,highCount:6-lowCount,consecutivePairs:values.slice(1).filter((n,i)=>n-values[i]===1).length,digitalRoot:digitalRoot(sum),decadeDistribution:Array.from({length:Math.ceil(maxNumber/10)},(_,i)=>i*10).map(start=>values.filter(n=>n>start&&n<=Math.min(start+10,maxNumber)).length)};}
export function calculateStructureDistribution(draws:Draw[],maxNumber=45){const structures=draws.map(draw=>calculateDrawStructure(draw,maxNumber));return {structures,sum:{mean:mean(structures.map(x=>x.sum)),median:median(structures.map(x=>x.sum)),stdDev:stdDev(structures.map(x=>x.sum)),q1:quantile(structures.map(x=>x.sum),.25),q3:quantile(structures.map(x=>x.sum),.75)}};}
export function calculateNoveltyScore(numbers:number[],history:Draw[]){const maxHistoricalOverlap=history.length?Math.max(...history.map(draw=>numbers.filter(number=>draw.numbers.includes(number)).length)):0;return {maxHistoricalOverlap,score:clamp(100-maxHistoricalOverlap/6*100)};}
export function detectStatisticalAnomalies(singles:SingleNumberStats[],settings:AnalysisSettings){return singles.flatMap(item=>{const result:{number:number;type:string;severity:string;value:number;explanation:string}[]=[];if(Math.abs(item.frequencyZ)>=(settings.frequencyZAlertThreshold??2))result.push({number:item.number,type:item.frequencyZ>0?"FREQUENCY_HIGH":"FREQUENCY_LOW",severity:Math.abs(item.frequencyZ)>=3?"STRONG":"WARNING",value:item.frequencyZ,explanation:`Historical frequency Z ${round2(item.frequencyZ)}`});if(item.gap.gapPercentile>=(settings.gapPercentileAlertThreshold??95)||item.gap.gapZ>=(settings.gapZAlertThreshold??2))result.push({number:item.number,type:"GAP_HIGH",severity:item.gap.gapPercentile>=99?"STRONG":"WARNING",value:item.gap.gapPercentile,explanation:`Current gap is unusually long relative to this number's history (${round2(item.gap.gapPercentile)}th percentile)`});if(Math.abs(item.recentZ30)>=(settings.recentZAlertThreshold??2))result.push({number:item.number,type:item.recentZ30>0?"RECENT_HIGH":"RECENT_LOW",severity:Math.abs(item.recentZ30)>=3?"STRONG":"WARNING",value:item.recentZ30,explanation:`Recent historical frequency Z ${round2(item.recentZ30)}`});return result;});}

export function calculateSingles(draws: Draw[], settings: AnalysisSettings,maxNumber=45): SingleNumberStats[] {
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date));
  const totalDraws=ordered.length;
  const p=6/maxNumber;
  const expectedCount=totalDraws*p;
  const sigma=Math.sqrt(totalDraws*p*(1-p));
  const windowCount=(number:number,size:number)=>ordered.slice(-size).filter(draw=>draw.numbers.includes(number)).length;
  const raw = Array.from({ length:maxNumber }, (_, index) => {
    const number = index + 1;
    const appearances = ordered.flatMap((d, i) => d.numbers.includes(number) ? [i] : []);
    const gaps = appearances.slice(1).map((v, i) => v - appearances[i] - 1);
    const totalCount = appearances.length;
    const currentGap = totalCount ? totalDraws - 1 - appearances.at(-1)! : totalDraws;
    const averageGap = gaps.length ? mean(gaps) : currentGap || 0;
    const maxGap = gaps.length ? Math.max(...gaps) : currentGap;
    const rolling={last10:windowCount(number,10),last20:windowCount(number,20),last30:windowCount(number,30),last50:windowCount(number,50),last100:windowCount(number,100),all:totalCount};
    const countLast10 = rolling.last10;
    const countLast30 = rolling.last30;
    const frequencyRate = totalDraws ? totalCount / totalDraws : 0;
    const recentRate = totalDraws ? countLast30 / Math.min(30, totalDraws) : 0;
    const trend30 = frequencyRate > 0 ? recentRate / frequencyRate : 0;
    const gapRatio = averageGap > 0 ? currentGap / averageGap : 0;
    const state: NumberState = trend30 >= 1.3 && gapRatio < .8 ? "HOT" : gapRatio >= 2 ? "DROUGHT" : gapRatio >= 1.5 ? "DUE" : trend30 < .8 ? "COOL" : "NEUTRAL";
    const lambda=Math.log(2)/Math.max(1,settings.weightedFrequencyHalfLife ?? 30);
    const weightedFrequency=ordered.reduce((sum,draw,drawIndex)=>sum+(draw.numbers.includes(number)?Math.exp(-lambda*(totalDraws-1-drawIndex)):0),0);
    const gapMean=mean(gaps), gapStd=stdDev(gaps);
    const gap={gaps,currentGap,meanGap:gapMean,medianGap:median(gaps),minGap:gaps.length?Math.min(...gaps):0,maxGap,stdGap:gapStd,q1:quantile(gaps,.25),q3:quantile(gaps,.75),gapPercentile:percentileRank(gaps,currentGap),gapZ:zScore(currentGap,gapMean,gapStd),gapCV:gapMean?gapStd/gapMean:0};
    const ratio10vs30=ratio(rolling.last10,Math.min(10,totalDraws),rolling.last30,Math.min(30,totalDraws));
    const ratio10vs50=ratio(rolling.last10,Math.min(10,totalDraws),rolling.last50,Math.min(50,totalDraws));
    const ratio30vs100=ratio(rolling.last30,Math.min(30,totalDraws),rolling.last100,Math.min(100,totalDraws));
    const label:SingleNumberStats["momentum"]["label"]=ratio10vs30>1.4?"ACCELERATING":ratio10vs30>=1.1?"RISING":ratio10vs30>=.9?"STABLE":"FALLING";
    const recentN=Math.min(30,totalDraws), expected30=recentN*p, sigma30=Math.sqrt(recentN*p*(1-p));
    return { number,totalCount,frequencyRate,currentGap,averageGap,maxGap,countLast10,countLast30,trend30,gapRatio,state,inside:INSIDE_SET.has(number),parity:number%2?"ODD" as const:"EVEN" as const,weightedFrequency,rolling,expectedCount,lower95:Math.max(0,expectedCount-1.96*sigma),upper95:expectedCount+1.96*sigma,frequencyZ:zScore(totalCount,expectedCount,sigma),recentZ30:zScore(countLast30,expected30,sigma30),gap,momentum:{ratio10vs30,ratio10vs50,ratio30vs100,label}};
  });
  const weightedScores=normalizeMinMax(raw.map(item=>item.weightedFrequency));
  const rollingRanks=raw.map(item=>percentileRank(raw.map(x=>x.rolling.last30),item.rolling.last30));
  const pairCounts=Array.from({length:maxNumber+1},()=>Array(maxNumber+1).fill(0));
  ordered.forEach(draw=>combinations([...draw.numbers],2).forEach(([a,b])=>{pairCounts[a][b]++;pairCounts[b][a]++;}));
  const associationRaw=raw.map(item=>{
    const lifts:number[]=[];
    for(let other=1;other<=maxNumber;other++) if(other!==item.number){const pairCount=pairCounts[item.number][other];const otherCount=raw[other-1]?.totalCount??0;const expected=totalDraws?(item.totalCount/totalDraws)*(otherCount/totalDraws):0;if(pairCount>=(settings.minPairSupport??2)&&expected>0)lifts.push((pairCount/totalDraws)/expected);}
    return mean(lifts.sort((a,b)=>b-a).slice(0,5));
  });
  const associationScores=normalizeMinMax(associationRaw);
  const gapStability=raw.map(item=>clamp(100/(1+item.gap.gapCV)));
  const scored=raw.map((item,index)=>{
    const frequencyScore=.35*clamp(50+item.frequencyZ*15)+.40*weightedScores[index]+.25*rollingRanks[index];
    const momentumScore=.5*clamp(item.momentum.ratio10vs30/1.5*100)+.3*clamp(item.momentum.ratio30vs100/1.5*100)+.2*clamp(50+item.recentZ30*15);
    const gapScore=.5*item.gap.gapPercentile+.25*clamp(Math.abs(item.gap.gapZ)/3*100)+.25*gapStability[index];
    const supportConfidence:Confidence=totalDraws>=100?"HIGH":totalDraws>=50?"MEDIUM":"LOW";
    return {...item,frequencySignal:signal(item.frequencyZ,frequencyScore,[`Observed ${item.totalCount}; expected ${round2(item.expectedCount)}`,`Weighted frequency ${round2(item.weightedFrequency)}`],supportConfidence),momentumSignal:signal(item.momentum.ratio10vs30,momentumScore,[`${item.momentum.label}: 10/30 ratio ${round2(item.momentum.ratio10vs30)}`],supportConfidence),gapSignal:signal(item.gap.gapPercentile,gapScore,[`Gap percentile ${round2(item.gap.gapPercentile)}%`,`Gap Z ${round2(item.gap.gapZ)}; interval CV ${round2(item.gap.gapCV)}`],item.gap.gaps.length>=10?supportConfidence:"LOW"),associationSignal:signal(associationRaw[index],associationScores[index],[`Supported pair-lift signal ${round2(associationRaw[index])}`],associationRaw[index]?supportConfidence:"LOW")};
  });
  for(const key of ["frequencySignal","momentumSignal","gapSignal","associationSignal"] as const){const orderedSignals=[...scored].sort((a,b)=>b[key].normalizedScore-a[key].normalizedScore||a.number-b.number);orderedSignals.forEach((item,i)=>{item[key].rank=i+1;item[key].percentileRank=round2(100*(scored.length-i)/scored.length);});}
  const consensusWeights=settings.consensusWeights??{frequency:25,momentum:25,gap:25,association:25};
  const withConsensus=scored.map(item=>{const components=[item.frequencySignal,item.momentumSignal,item.gapSignal,item.associationSignal];const consensus=(item.frequencySignal.percentileRank*consensusWeights.frequency+item.momentumSignal.percentileRank*consensusWeights.momentum+item.gapSignal.percentileRank*consensusWeights.gap+item.associationSignal.percentileRank*consensusWeights.association)/Object.values(consensusWeights).reduce((a,b)=>a+b,0);const agreement=components.filter(model=>model.rank<=10).length;const confidence:Confidence=agreement>=3&&totalDraws>=100&&item.associationSignal.confidence!=="LOW"?"HIGH":agreement>=2&&totalDraws>=50?"MEDIUM":"LOW";return {...item,models:{frequency:item.frequencySignal,momentum:item.momentumSignal,gap:item.gapSignal,association:item.associationSignal,consensus:signal(consensus,consensus,[`${agreement}/4 component models rank this number in the Top 10`],confidence)},modelAgreement:agreement,confidence,technicalScore:round2(consensus),rank:0};});
  const ranked=[...withConsensus].sort((a,b)=>b.technicalScore-a.technicalScore||a.number-b.number);
  ranked.forEach((item,index)=>{item.rank=index+1;item.models.consensus.rank=index+1;item.models.consensus.percentileRank=round2(100*(ranked.length-index)/ranked.length);});
  return withConsensus;
}

export function calculatePairs(draws: Draw[],maxNumber=45): PairStats[] {
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
    result.push({ a, b, key: `${pad(a)}-${pad(b)}`, count, rate: draws.length ? count / draws.length : 0, lift:expected?(count/draws.length)/expected:0,recentCount,recentLift:recentExpected?(recentCount/recent.length)/recentExpected:0,confidence:pairConfidence(count), insideCount: Number(INSIDE_SET.has(a)) + Number(INSIDE_SET.has(b)), outsideCount: Number(!INSIDE_SET.has(a)) + Number(!INSIDE_SET.has(b)), evenCount: Number(a % 2 === 0) + Number(b % 2 === 0), oddCount: Number(a % 2 !== 0) + Number(b % 2 !== 0), rank: 0 });
  }
  result.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).forEach((x, i) => x.rank = i + 1);
  return result;
}

export function calculateTriples(draws: Draw[],maxNumber=45): TripleStats[] {
  const map = new Map<string, { numbers: [number, number, number]; count: number }>();
  draws.forEach(draw => combinations([...draw.numbers], 3).forEach(nums => {
    const sorted = nums.sort((a, b) => a - b) as [number, number, number];
    const key = sorted.map(pad).join("-");
    const prev = map.get(key);
    map.set(key, { numbers: sorted, count: (prev?.count ?? 0) + 1 });
  }));
  const counts=new Map(Array.from({length:maxNumber},(_,i)=>[i+1,draws.filter(draw=>draw.numbers.includes(i+1)).length]));
  return [...map.entries()].map(([key, item]) => {const expected=item.numbers.reduce((product,n)=>product*((counts.get(n)??0)/Math.max(1,draws.length)),1);return { ...item, key, rate: draws.length ? item.count / draws.length : 0,lift:expected?(item.count/draws.length)/expected:0,confidence:pairConfidence(item.count), insideCount: item.numbers.filter(n => INSIDE_SET.has(n)).length, outsideCount: item.numbers.filter(n => !INSIDE_SET.has(n)).length, evenCount: item.numbers.filter(n => n % 2 === 0).length, oddCount: item.numbers.filter(n => n % 2 !== 0).length, rank: 0 };}).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).map((x, i) => ({ ...x, rank: i + 1 }));
}

export function scoreCandidateCombinations(numberSets:number[][],singles:SingleNumberStats[],pairs:PairStats[],triples:TripleStats[],settings:AnalysisSettings,history:Draw[]=[]):CandidateCombination[]{
  const maxNumber=singles.length||45;
  const observedDraws=history.length||singles.reduce((sum,item)=>sum+item.totalCount,0)/6;
  const singleMap = new Map(singles.map(x => [x.number,{
    chance:chanceAdjustedSubsetScore(x.totalCount,observedDraws,1,maxNumber),
    consensus:x.models.consensus.normalizedScore,
  }]));
  const pairMap = new Map(pairs.map(x => [x.key, x]));
  const tripleMap = new Map(triples.map(x => [x.key, x]));
  const w = settings.comboWeightsV2??{consensus:30,pair:20,triple:10,structure:25,novelty:15};
  const historySets=history.map(draw=>new Set(draw.numbers));
  return numberSets.map(numbers => {
    const total = numbers.reduce((a, b) => a + b, 0);
    const root = digitalRoot(total);
    const evenCount = numbers.filter(n => n % 2 === 0).length;
    const insideCount = numbers.filter(n => INSIDE_SET.has(n)).length;
    const pairScore = combinations(numbers, 2).reduce((sum, pair) => {
      const stat=pairMap.get([...pair].sort((a,b)=>a-b).map(pad).join("-"));
      return sum+chanceAdjustedSubsetScore(stat?.count??0,observedDraws,2,maxNumber);
    }, 0) / 15;
    const tripleScore = combinations(numbers, 3).reduce((sum, triple) => {
      const stat=tripleMap.get([...triple].sort((a,b)=>a-b).map(pad).join("-"));
      return sum+chanceAdjustedSubsetScore(stat?.count??0,observedDraws,3,maxNumber);
    }, 0) / 20;
    // Blend calibrated frequency evidence with consensus so scoring presets
    // can continue to emphasize gap, momentum, and association signals.
    const singleScore = numbers.reduce((sum, n) => {
      const item=singleMap.get(n);
      return sum+(item?(item.chance+item.consensus)/2:50);
    }, 0) / 6;
    // Uniform draws provide no evidence for preferring any particular digital root.
    const structureRaw = 0;
    const parity = evenCount === 3 ? 30 : evenCount === 2 || evenCount === 4 ? 25 : 0;
    const distribution = insideCount === 4 ? 30 : insideCount === 3 ? 25 : 0;
    const structureScore = structureRaw + parity + distribution + (total >= settings.minTotal ? 10 : 0);
    const valid = total >= settings.minTotal && settings.allowedDigitalRoots.includes(root) && settings.allowedParity.includes(`${evenCount}/${6-evenCount}`) && settings.allowedInsideOutside.includes(`${insideCount}/${6-insideCount}`);
    const maxHistoricalOverlap=historySets.length?Math.max(...historySets.map(draw=>numbers.reduce((count,number)=>count+Number(draw.has(number)),0))):0;
    const noveltyScore=history.length?clamp(100-maxHistoricalOverlap/6*100):100;
    const totalScore = (singleScore*w.consensus+pairScore*w.pair+tripleScore*w.triple+structureScore*w.structure+noveltyScore*w.novelty)/100;
    const confidence:Confidence=numbers.filter(n=>(singles[n-1]?.confidence??"LOW")!=="LOW").length>=4?"MEDIUM":"LOW";
    return { numbers, total, digitalRoot: root, evenCount, oddCount: 6-evenCount, insideCount, outsideCount: 6-insideCount, singleScore, pairScore, tripleScore, structureScore, noveltyScore,maxHistoricalOverlap,totalScore,confidence,valid };
  });
}

export function calculateScoreTimeline(draws:Draw[],settings:AnalysisSettings,maxNumber=45,targetDrawIds?:string[]){
  const ordered=[...draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!ordered.length)return [];
  const targets=targetDrawIds?new Set(targetDrawIds):undefined;
  const points=ordered.flatMap((draw,index)=>{
    if(targets&&!targets.has(draw.id))return [];
    const history=ordered.slice(Math.max(0,index-30),index);
    const singles=calculateSingles(history,settings,maxNumber);
    const pairs=calculatePairs(history,maxNumber);
    const triples=calculateTriples(history,maxNumber);
    const [score]=scoreCandidateCombinations([draw.numbers],singles,pairs,triples,settings,history);
    return {id:draw.id,date:draw.date,single:round2(score.singleScore),pair:round2(score.pairScore),triple:round2(score.tripleScore),structure:round2(score.structureScore),total:round2(score.totalScore)};
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

export function generateCandidates(singles: SingleNumberStats[], pairs: PairStats[], triples: TripleStats[], settings: AnalysisSettings, history:Draw[]=[]): CandidateCombination[] {
  const ranked = [...singles].sort((a, b) => b.technicalScore - a.technicalScore || a.number - b.number);
  // The inside preference can otherwise fill the entire pool with inside numbers,
  // making the required 4/2 or 3/3 structure mathematically impossible.
  const insideAvailable=ranked.filter(item=>item.inside).length;
  const insideTarget = Math.round(settings.candidatePoolSize * insideAvailable / Math.max(1,ranked.length));
  const pool = [
    ...ranked.filter(x => x.inside).slice(0, insideTarget),
    ...ranked.filter(x => !x.inside).slice(0, settings.candidatePoolSize - insideTarget),
  ].map(x => x.number).sort((a, b) => a - b);
  const candidates=scoreCandidateCombinations(combinations(pool,6),singles,pairs,triples,settings,history).filter(x=>x.valid).sort((a,b)=>b.totalScore-a.totalScore);
  const rootsPresent=new Set(candidates.map(candidate=>candidate.digitalRoot));
  const missingRoots=settings.allowedDigitalRoots.filter(root=>!rootsPresent.has(root));
  const parityPresent=new Set(candidates.map(candidate=>`${candidate.evenCount}/${candidate.oddCount}`));
  const missingParity=settings.allowedParity.filter(parity=>!parityPresent.has(parity));
  const rootAlternatives:number[][]=[];
  const targetCounts=new Map<string,number>([
    ...missingRoots.map(root=>[`root:${root}`,0] as [string,number]),
    ...missingParity.map(parity=>[`parity:${parity}`,0] as [string,number]),
  ]);
  if(targetCounts.size){
    const maxNumber=singles.length||45;
    for(const source of candidates.slice(0,60)){
      for(let index=0;index<source.numbers.length;index++) for(let number=1;number<=maxNumber;number++){
        if(source.numbers.includes(number))continue;
        const numbers=[...source.numbers];
        numbers[index]=number;
        const total=numbers.reduce((sum,value)=>sum+value,0);
        const root=digitalRoot(total);
        const rootKey=`root:${root}`;
        if(!settings.allowedDigitalRoots.includes(root))continue;
        const even=numbers.filter(value=>value%2===0).length;
        const parity=`${even}/${6-even}`;
        const parityKey=`parity:${parity}`;
        const targetKeys=[rootKey,parityKey].filter(key=>targetCounts.has(key)&&(targetCounts.get(key)??0)<12);
        if(!targetKeys.length)continue;
        const inside=numbers.filter(value=>INSIDE_SET.has(value)).length;
        if(total<settings.minTotal||!settings.allowedParity.includes(parity)||!settings.allowedInsideOutside.includes(`${inside}/${6-inside}`))continue;
        const key=[...numbers].sort((a,b)=>a-b).join("-");
        if(rootAlternatives.some(item=>[...item].sort((a,b)=>a-b).join("-")===key))continue;
        rootAlternatives.push(numbers);
        targetKeys.forEach(target=>targetCounts.set(target,(targetCounts.get(target)??0)+1));
      }
      if([...targetCounts.values()].every(count=>count>=12))break;
    }
  }
  const alternatives=rootAlternatives.length?scoreCandidateCombinations(rootAlternatives,singles,pairs,triples,settings,history).filter(candidate=>candidate.valid):[];
  const allCandidates=[...candidates,...alternatives].sort((a,b)=>b.totalScore-a.totalScore);
  const selected: CandidateCombination[] = [];
  // Seed the list with the strongest compatible candidate from each allowed root.
  for(const root of settings.allowedDigitalRoots){
    const candidate=allCandidates.find(item=>item.digitalRoot===root&&selected.every(existing=>item.numbers.filter(n=>existing.numbers.includes(n)).length<=settings.maxCombinationOverlap));
    if(candidate)selected.push(candidate);
  }
  for(const parity of settings.allowedParity){
    const candidate=allCandidates.find(item=>`${item.evenCount}/${item.oddCount}`===parity&&selected.every(existing=>item.numbers.filter(n=>existing.numbers.includes(n)).length<=settings.maxCombinationOverlap));
    if(candidate&&!selected.includes(candidate))selected.push(candidate);
  }
  for (const candidate of allCandidates) {
    if(selected.includes(candidate))continue;
    if (selected.every(existing => candidate.numbers.filter(n => existing.numbers.includes(n)).length <= settings.maxCombinationOverlap)) selected.push(candidate);
    if (selected.length >= Math.max(20, settings.topCombinationCount)) break;
  }
  return selected.sort((a,b)=>b.totalScore-a.totalScore).map((x, i) => ({ ...x, rank: i + 1 }));
}

export function backtest(draws: Draw[], settings: AnalysisSettings, count = 12,maxNumber=45) {
  const distribution = [0,0,0,0,0,0,0];
  let totalMatches = 0; let best = 0; let tests = 0;
  for (let i = Math.max(10, draws.length - count); i < draws.length; i++) {
    const history = draws.slice(0, i);
    const predictions = generateCandidates(calculateSingles(history,settings,maxNumber),calculatePairs(history,maxNumber),calculateTriples(history,maxNumber),settings,history).slice(0,5);
    const match = predictions.reduce((m, p) => Math.max(m, p.numbers.filter(n => draws[i].numbers.includes(n)).length), 0);
    distribution[match]++; totalMatches += match; best = Math.max(best, match); tests++;
  }
  return { distribution, average: tests ? totalMatches / tests : 0, best, tests };
}

export type BacktestRangeOptions={fromDate:string;toDate:string;trainingDraws:number;predictionCount:number;maxNumber?:number;manualProposedSets?:number[][]};
export type BacktestPrediction=CandidateCombination&{count:number;rate:number;matches:number};
export type BacktestResultRow={targetId:string;date:string;predictions:BacktestPrediction[];actual:number[];bestMatches:number};

export function getBacktestTrainingWindows(draws:Draw[],fromDate:string,toDate:string){
  const priorDraws=Math.max(0,draws.filter(draw=>draw.date>=fromDate&&draw.date<=toDate).length-1);
  return {priorDraws,windows:priorDraws>=100?[30,50,100]:priorDraws>=50?[30,50]:priorDraws>=30?[30]:[]};
}

export function backtestRange(draws:Draw[],settings:AnalysisSettings,options:BacktestRangeOptions){
  const distribution=[0,0,0,0,0,0,0];
  const rows:BacktestResultRow[]=[];
  let totalMatches=0,best=0;
  const trainingDraws=Math.max(10,options.trainingDraws);
  const predictionCount=Math.max(1,options.predictionCount);
  const maxNumber=options.maxNumber??45;
  const evaluate=(history:Draw[],actual:number[],targetId:string,date:string,manualProposedSets?:number[][])=>{
    const singles=calculateSingles(history,settings,maxNumber);
    const pairs=calculatePairs(history,maxNumber);
    const triples=calculateTriples(history,maxNumber);
    const candidates=manualProposedSets?.length?scoreCandidateCombinations(manualProposedSets,singles,pairs,triples,settings,history):generateCandidates(singles,pairs,triples,settings,history).slice(0,predictionCount);
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
  const range=draws.filter(draw=>draw.date>=options.fromDate&&draw.date<=options.toDate);
  const manualProposedSets=options.manualProposedSets;
  const targets=range.slice(-1);
  targets.forEach((target,index)=>{
    const targetIndex=range.indexOf(target);
    const history=range.slice(0,targetIndex).slice(-trainingDraws);
    if(history.length===trainingDraws)evaluate(history,target.numbers,target.id,target.date,manualProposedSets);
  });
  return {distribution,average:rows.length?totalMatches/rows.length:0,best,tests:rows.length,rows};
}

export function runRollingBacktest(draws:Draw[],settings:AnalysisSettings,targetCount=30,seed=645,maxNumber=45){
  const minimum=Math.max(1,Math.min(settings.backtestMinTrainingDraws??50,draws.length-1));
  const start=Math.max(minimum,draws.length-targetCount);
  let randomState=seed>>>0;
  const random=()=>{randomState=(1664525*randomState+1013904223)>>>0;return randomState/4294967296;};
  const rows=[];
  for(let index=start;index<draws.length;index++){
    const training=draws.slice(0,index),actual=draws[index].numbers;
    const ranked=[...calculateSingles(training,settings,maxNumber)].sort((a,b)=>a.rank-b.rank);
    const shuffled=Array.from({length:maxNumber},(_,i)=>i+1).sort(()=>random()-.5);
    const actualRanks=actual.map(number=>ranked.find(item=>item.number===number)?.rank??maxNumber);
    rows.push({targetId:draws[index].id,top5:actualRanks.filter(rank=>rank<=5).length,top10:actualRanks.filter(rank=>rank<=10).length,top15:actualRanks.filter(rank=>rank<=15).length,meanActualRank:mean(actualRanks),randomTop10:actual.filter(number=>shuffled.slice(0,10).includes(number)).length});
  }
  return {rows,tests:rows.length,modelTop10HitRate:rows.length?mean(rows.map(row=>row.top10/6)):0,randomTop10HitRate:rows.length?mean(rows.map(row=>row.randomTop10/6)):0,meanActualRank:rows.length?mean(rows.map(row=>row.meanActualRank)):0,seed};
}
