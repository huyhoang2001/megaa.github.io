import { describe, expect, it } from "vitest";
import { backtest, backtestRange, buildCandidateNumberPool, buildRecentDrawCooldownSet, calculateChiSquareUniformity, calculateExpectedFrequencyBand, calculateGapDistribution, calculateMonthlyDraws, calculateOccurrenceTimeline, calculatePairs, calculatePortfolioCoverage, calculateRollingFrequency, calculateScoreTimeline, calculateSingles, calculateTriples, calculateWeightedFrequency, chanceAdjustedSubsetScore, calibrateProposalScore, digitalRoot, exactTopNumbers, filterCombinationsByNumbers, filterCombinationsByScores, filterCompleteCalendarMonths, filterDraws, generateBacktestProposals, generateCandidateUniverse, generateCandidates, generateSuggestedPortfolio, getBacktestTrainingWindows, parseCompactCombinations, percentileRank, periodHalfLife, round2, runPortfolioRollingBacktest, runRollingBacktest, scoreCandidateCombinations, selectExperimentalPowerPortfolio, selectFilteredPortfolio, selectPortfolio, validCombinationScoreRanges, weightedAverage } from "./analytics";
import type { CombinationScoreRanges } from "./analytics";
import { DEFAULT_SETTINGS, INSIDE_SET, LOTTO535_INSIDE_NUMBERS } from "./domain";
import type { Draw, SingleNumberStats } from "./domain";
import history from "./data/mega645-history.json";
import powerHistory from "./data/power655-history.json";
import lottoHistory from "./data/lotto535-history.json";
import { settingsForPreset } from "./hooks";
import { addDays, format, parseISO, startOfMonth, subMonths } from "date-fns";

const draws: Draw[] = [
  { id:"1", date:"2026-01-01", numbers:[1,2,3,4,5,6], jackpot:1 },
  { id:"2", date:"2026-01-08", numbers:[1,7,8,9,10,11], jackpot:2 },
  { id:"3", date:"2026-01-15", numbers:[2,7,12,13,14,15], jackpot:3 },
  { id:"4", date:"2026-01-22", numbers:[1,2,16,17,18,19], jackpot:4 },
  { id:"5", date:"2026-01-29", numbers:[3,7,20,21,22,23], jackpot:5 },
  { id:"6", date:"2026-02-05", numbers:[1,2,3,24,25,26], jackpot:6 },
  { id:"7", date:"2026-02-12", numbers:[4,7,27,28,29,30], jackpot:7 },
  { id:"8", date:"2026-02-19", numbers:[1,5,31,32,33,34], jackpot:8 },
  { id:"9", date:"2026-02-26", numbers:[2,6,35,36,37,38], jackpot:9 },
  { id:"10", date:"2026-03-05", numbers:[1,2,3,39,40,41], jackpot:10 },
  { id:"11", date:"2026-03-12", numbers:[4,5,6,42,43,44], jackpot:11 },
  { id:"12", date:"2026-03-19", numbers:[1,2,3,4,7,45], jackpot:12 },
];

describe("analytics", () => {
  it("scores Lotto 5/35 predictions with its five-number draw size and inside range",()=>{
    const lotto=lottoHistory.draws as Draw[],inside=new Set(LOTTO535_INSIDE_NUMBERS),settings={...DEFAULT_SETTINGS,minTotal:35,allowedParity:["3/2","2/3"],allowedInsideOutside:["3/2","4/1","2/3"]};
    const singles=calculateSingles(lotto.slice(0,80),settings,35,LOTTO535_INSIDE_NUMBERS);
    const pairs=calculatePairs(lotto.slice(0,80),35,LOTTO535_INSIDE_NUMBERS),triples=calculateTriples(lotto.slice(0,80),35,LOTTO535_INSIDE_NUMBERS);
    const [candidate]=scoreCandidateCombinations([[3,8,12,21,24]],singles,pairs,triples,settings,lotto.slice(0,80),LOTTO535_INSIDE_NUMBERS);
    expect(candidate.numbers).toHaveLength(5);
    expect(candidate.valid).toBe(true);
    expect(candidate.insideCount).toBe(4);
    expect(singles.find(item=>item.number===3)?.inside).toBe(inside.has(3));
    expect(parseCompactCombinations("0308122224",35,5).valid).toBe(true);
  });
  it("filters periods without changing order", () => expect(filterDraws(draws,"last10").map(d=>d.id)).toEqual(draws.slice(-10).map(d=>d.id)));
  it("selects the latest 20 draws", () => {
    const real=history.draws as Draw[];
    expect(filterDraws(real,"last20").map(draw=>draw.id)).toEqual(real.slice(-20).map(draw=>draw.id));
  });
  it("ends rolling month periods at the latest available draw", () => {
    const real=history.draws as Draw[];
    const year=filterDraws(real,"last1year");
    const sixMonths=filterDraws(real,"last6months");
    const latestMega=real.at(-1)!;
    const yearCutoff=format(subMonths(parseISO(latestMega.date),12),"yyyy-MM-dd");
    const sixMonthCutoff=format(subMonths(parseISO(latestMega.date),6),"yyyy-MM-dd");
    expect(year.map(draw=>draw.id)).toEqual(real.filter(draw=>draw.date>=yearCutoff&&draw.date<=latestMega.date).map(draw=>draw.id));
    expect(sixMonths.map(draw=>draw.id)).toEqual(real.filter(draw=>draw.date>=sixMonthCutoff&&draw.date<=latestMega.date).map(draw=>draw.id));
    expect(year.at(-1)?.date).toBe(latestMega.date);
    expect(sixMonths.at(-1)?.date).toBe(latestMega.date);
    expect(filterDraws([real.at(-1)!,real[0]],"all").map(draw=>draw.date)).toEqual([real[0].date,real.at(-1)!.date]);
    const power=powerHistory.draws as Draw[];
    const latestPower=power.at(-1)!;
    const powerCutoff=format(subMonths(parseISO(latestPower.date),6),"yyyy-MM-dd");
    const powerSixMonths=filterDraws(power,"last6months");
    expect(powerSixMonths.map(draw=>draw.id)).toEqual(power.filter(draw=>draw.date>=powerCutoff&&draw.date<=latestPower.date).map(draw=>draw.id));
    expect(powerSixMonths.at(-1)?.date).toBe(latestPower.date);
  });
  it("calculates frequency, gaps, recent counts and ranking", () => {
    const one=calculateSingles(draws,DEFAULT_SETTINGS)[0];
    expect(one.totalCount).toBe(7); expect(one.currentGap).toBe(0); expect(one.maxGap).toBe(1); expect(one.countLast10).toBe(5); expect(one.countLast30).toBe(7); expect(one.rank).toBeGreaterThan(0);
  });
  it("counts all 990 pairs", () => { const pairs=calculatePairs(draws); expect(pairs).toHaveLength(990); expect(pairs.find(p=>p.key==="01-02")?.count).toBe(5); });
  it("counts and formats observed triples", () => { const triples=calculateTriples(draws); expect(triples.find(t=>t.key==="01-02-03")?.count).toBe(4); expect(triples.every(t=>/^\d{2}-\d{2}-\d{2}$/.test(t.key))).toBe(true); });
  it("computes digital roots", () => { expect(digitalRoot(186)).toBe(6); expect(digitalRoot(0)).toBe(0); });
  it("rounds technical values to hundredths", () => expect(round2(66.315)).toBe(66.32));
  it("shrinks subset frequencies toward the exact 6-of-M chance baseline",()=>{
    expect(chanceAdjustedSubsetScore(1,7,2,15)).toBe(50); // 1/7 is the pair baseline for 6 of 15
    expect(chanceAdjustedSubsetScore(3,1000,2,45)).toBeLessThan(50);
    expect(chanceAdjustedSubsetScore(4,1000,2,45)).toBeGreaterThan(chanceAdjustedSubsetScore(3,1000,2,45));
    expect(chanceAdjustedSubsetScore(1,1000,3,45)).toBeLessThan(90);
    expect(chanceAdjustedSubsetScore(1,0,3,45)).toBe(50);
    expect(chanceAdjustedSubsetScore(2,100,2,45)).toBeGreaterThan(50);
    expect(chanceAdjustedSubsetScore(0,100,3,45)).toBeLessThan(50);
    expect(chanceAdjustedSubsetScore(3,21,2,15)).toBe(50);
  });
  it("keeps gap scoring neutral until four completed gaps support it",()=>{
    const repeated=Array.from({length:4},(_,index)=>({...draws[0],id:`gap-${index}`}));
    expect(calculateGapDistribution(repeated,1).completedGapCount).toBe(3);
    expect(calculateGapDistribution(repeated,1).gapScore).toBe(50);
  });
  it("allocates an eligible candidate pool approximately 50/30/20 by number state",()=>{
    const synthetic=Array.from({length:45},(_,index)=>({number:index+1,totalCount:index<15?14:13,state:index<23?"NEUTRAL":index<37?"HOT":"COOL",inside:index<23,pickScore:100-index,technicalScore:index}));
    const pool=buildCandidateNumberPool(synthetic as unknown as SingleNumberStats[],{...DEFAULT_SETTINGS,candidatePoolSize:14},20);
    const states=pool.map(number=>synthetic[number-1].state);
    expect(states.filter(state=>state==="NEUTRAL")).toHaveLength(7);
    expect(states.filter(state=>state==="HOT")).toHaveLength(4);
    expect(states.filter(state=>state==="COOL")).toHaveLength(3);
    expect(buildCandidateNumberPool(synthetic as unknown as SingleNumberStats[],{...DEFAULT_SETTINGS,candidatePoolSize:Number.MAX_SAFE_INTEGER},20)).toHaveLength(45);
  });
  it("keeps generation and backtest retries within the configured candidate pool",()=>{
    const real=history.draws as Draw[],settings={...DEFAULT_SETTINGS,candidatePoolSize:10,topCombinationCount:500},training=real.slice(-100);
    const singles=calculateSingles(training,settings),pairs=calculatePairs(training),triples=calculateTriples(training);
    const pool=new Set(buildCandidateNumberPool(singles,settings,500,6));
    const generated=generateCandidates(singles,pairs,triples,settings,training);
    expect(pool.size).toBe(10);
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every(candidate=>candidate.numbers.every(number=>pool.has(number)))).toBe(true);
    const backtestTraining=real.slice(0,-2).slice(-100),backtestSingles=calculateSingles(backtestTraining,settings),backtestPool=new Set(buildCandidateNumberPool(backtestSingles,settings,5,6));
    const target=real.at(-1)!;
    const backtest=generateBacktestProposals(real,settings,{fromDate:real[0].date,toDate:target.date,trainingDraws:100,predictionCount:500,maxNumber:45,cooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:false}});
    expect(backtest.predictions.every(candidate=>candidate.numbers.every(number=>backtestPool.has(number)))).toBe(true);
  });
  it("builds the cooldown from newest full-history draws and optionally includes specials",()=>{
    const older:Draw={id:"9",date:"2026-01-01",numbers:[1,2,3,4,5,6],bonus:7,jackpot:0};
    const latest:Draw={id:"10",date:"2026-01-08",numbers:[8,9,10,11,12,13],bonus:14,jackpot:0};
    const options={enabled:true,draws:1,mode:"hard" as const,includeBonus:false,softPenalty:25};
    expect([...buildRecentDrawCooldownSet([latest,older],options)]).toEqual(latest.numbers);
    expect([...buildRecentDrawCooldownSet([older,latest],{...options,includeBonus:true})]).toEqual([...latest.numbers,14]);
    expect(buildRecentDrawCooldownSet([older],{...options,enabled:false}).size).toBe(0);
    expect(buildRecentDrawCooldownSet([older,latest],{...options,draws:2}).has(1)).toBe(true);
  });
  it("keeps hard-cooldown numbers out of candidate pools and generated tickets",()=>{
    const real=history.draws as Draw[],training=real.slice(-100),latest=real.at(-1)!;
    const settings={...DEFAULT_SETTINGS,candidatePoolSize:14};
    const singles=calculateSingles(training,settings,45),pairs=calculatePairs(training,45),triples=calculateTriples(training,45);
    const cooldown={numbers:new Set(latest.numbers),mode:"hard" as const,softPenalty:25};
    expect(buildCandidateNumberPool(singles,settings,20,6,cooldown).some(number=>cooldown.numbers.has(number))).toBe(false);
    const candidates=generateCandidateUniverse(singles,pairs,triples,settings,training,undefined,training,20,cooldown);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(candidate=>candidate.numbers.every(number=>!cooldown.numbers.has(number)))).toBe(true);
    const nextDraw:Draw={...latest,id:"next",date:format(addDays(parseISO(latest.date),1),"yyyy-MM-dd"),numbers:Array.from({length:45},(_,index)=>index+1).filter(number=>!latest.numbers.includes(number)).slice(0,6)};
    expect(buildRecentDrawCooldownSet([latest,nextDraw],{enabled:true,draws:1,mode:"hard",includeBonus:false,softPenalty:25}).has(latest.numbers[0])).toBe(false);
  });
  it("soft cooldown preserves candidate eligibility while lowering its single score",()=>{
    const training=draws.slice(0,10),singles=calculateSingles(training,DEFAULT_SETTINGS),pairs=calculatePairs(training),triples=calculateTriples(training);
    const numbers=[1,2,3,4,5,6],baseline=scoreCandidateCombinations([numbers],singles,pairs,triples,DEFAULT_SETTINGS,training)[0];
    const cooled=scoreCandidateCombinations([numbers],singles,pairs,triples,DEFAULT_SETTINGS,training,undefined,training,{numbers:new Set([1]),mode:"soft",softPenalty:25})[0];
    expect(cooled.singleScore).toBeLessThan(baseline.singleScore);
  });
  it("cooldown OFF is identical to bypassing cooldown, regardless of saved mode preferences",()=>{
    const training=(history.draws as Draw[]).slice(-50),settings={...DEFAULT_SETTINGS,recentDrawCooldown:{enabled:false,draws:4,mode:"soft" as const,includeBonus:true,softPenalty:47}},singles=calculateSingles(training,settings),pairs=calculatePairs(training);
    const bypass=generateSuggestedPortfolio(singles,pairs,settings,training,[...INSIDE_SET],5);
    const disabled=generateSuggestedPortfolio(singles,pairs,settings,training,[...INSIDE_SET],5,{numbers:buildRecentDrawCooldownSet(training,settings.recentDrawCooldown),mode:settings.recentDrawCooldown.mode,softPenalty:settings.recentDrawCooldown.softPenalty});
    expect(disabled).toEqual(bypass);
  });
  it("calibrates proposal scores toward chance",()=>{
    expect(calibrateProposalScore(80)).toBe(74);
    expect(calibrateProposalScore(20)).toBe(26);
    expect(chanceAdjustedSubsetScore(6,45,1,45)).toBe(50);
    expect(chanceAdjustedSubsetScore(6,55,1,55)).toBe(50);
  });
  it("derives weighted-frequency half-life from period and sample size",()=>{
    expect(periodHalfLife("last20",20)).toBe(10);
    expect(periodHalfLife("last50",50)).toBe(20);
    expect(periodHalfLife("last100",100)).toBe(30);
    expect(periodHalfLife("last1year",120)).toBe(37.5);
    expect(periodHalfLife("all",500)).toBe(45);
    expect(periodHalfLife("custom",30)).toBeGreaterThan(10);
  });
  it("builds a per-draw historical-frequency timeline with MA20", () => {
    const timeline=calculateOccurrenceTimeline(history.draws as Draw[]);
    expect(timeline).toHaveLength(history.draws.length);
    expect(new Set(timeline.map(x=>x.historicalFrequency)).size).toBeGreaterThan(1);
    expect(timeline.every(x=>Number.isFinite(x.ma20))).toBe(true);
    expect(timeline.at(-1)?.ma20).toBe(round2(timeline.slice(-20).reduce((sum,item)=>sum+item.historicalFrequency,0)/20));
  });
  it("preserves the 20-previous-draw window in the optimized occurrence timeline",()=>{
    const draws:Draw[]=Array.from({length:27},(_,index)=>({id:String(index),date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),numbers:[index%8+1,(index+3)%8+1],jackpot:0}));
    const points=draws.map((draw,index)=>({id:draw.id,date:draw.date,historicalFrequency:draw.numbers.reduce((sum,number)=>sum+draws.slice(Math.max(0,index-20),index).filter(previous=>previous.numbers.includes(number)).length,0)}));
    const expected=points.map((point,index)=>({...point,ma20:round2(points.slice(Math.max(0,index-19),index+1).reduce((sum,item)=>sum+item.historicalFrequency,0)/Math.min(20,index+1))}));
    expect(calculateOccurrenceTimeline(draws)).toEqual(expected);
  });
  it("builds all five score timelines with a 20-period moving average",()=>{
    const timeline=calculateScoreTimeline((history.draws as Draw[]).slice(-75),DEFAULT_SETTINGS);
    expect(timeline).toHaveLength(25);
    expect(timeline.every(point=>[point.single,point.pair,point.gap,point.structure,point.novelty,point.total,point.singleMa20,point.pairMa20,point.structureMa20,point.totalMa20].every(Number.isFinite))).toBe(true);
    expect(timeline.at(-1)?.singleMa20).toBe(round2(timeline.slice(-20).reduce((sum,point)=>sum+point.single,0)/20));
  });
  it("uses 50 earlier draws and omits targets with insufficient history",()=>{
    const source=(history.draws as Draw[]).slice(-56);
    const targets=source.slice(-6);
    const timeline=calculateScoreTimeline(source,DEFAULT_SETTINGS,45,targets.map(draw=>draw.id));
    expect(timeline.map(point=>point.id)).toEqual(targets.map(draw=>draw.id));
    expect(calculateScoreTimeline(draws,DEFAULT_SETTINGS)).toEqual([]);
  });
  it("keeps score training windows separate from the displayed date range",()=>{
    const source=(history.draws as Draw[]).slice(-110);
    const target=source.at(-1)!;
    for(const window of [30,50,100]){
      const point=calculateScoreTimeline(source,DEFAULT_SETTINGS,45,[target.id],window)[0];
      const training=source.slice(-window-1,-1);
      const [expected]=scoreCandidateCombinations([target.numbers],calculateSingles(training,DEFAULT_SETTINGS),calculatePairs(training),calculateTriples(training),DEFAULT_SETTINGS,training,[...INSIDE_SET],training);
      expect(point.total).toBe(round2(expected.totalScore));
      expect(point.structure).toBe(round2(expected.structureScore));
      expect(calculateScoreTimeline(source,DEFAULT_SETTINGS,45,[target.id],window)).toHaveLength(1);
    }
  });
  it("groups draw density by calendar month", () => {
    const real=history.draws as Draw[];
    const monthly=calculateMonthlyDraws(filterCompleteCalendarMonths(real,12));
    const latestMonth=format(startOfMonth(parseISO(real.at(-1)!.date)),"yyyy-MM");
    expect(monthly).toHaveLength(12);
    expect(monthly.every(item=>item.month<latestMonth&&item.draws>0)).toBe(true);
    expect(monthly.map(item=>item.month)).toEqual([...monthly.map(item=>item.month)].sort());
  });
  it("knows parity and inside membership", () => { expect(INSIDE_SET.has(2)).toBe(true); expect(INSIDE_SET.has(45)).toBe(false); });
  it("supports the Power 6/55 number space and supplied inside set",()=>{
    const power=(powerHistory.draws as Draw[]).slice(-100);
    const singles=calculateSingles(power,DEFAULT_SETTINGS,55);
    const pairs=calculatePairs(power,55);
    const triples=calculateTriples(power,55);
    expect(singles).toHaveLength(55);
    expect(pairs).toHaveLength(1485);
    expect(singles.find(item=>item.number===55)).toBeDefined();
    const candidates=generateCandidates(singles,pairs,triples,DEFAULT_SETTINGS,power);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(candidate=>candidate.numbers.every(number=>number<=55))).toBe(true);
    expect(INSIDE_SET.has(47)).toBe(true);
    expect(INSIDE_SET.has(55)).toBe(true);
  });
  it("builds a deterministic Power coverage portfolio without changing the first five",()=>{
    const training=(powerHistory.draws as Draw[]).slice(-51,-1);
    const singles=calculateSingles(training,DEFAULT_SETTINGS,55),pairs=calculatePairs(training,55),triples=calculateTriples(training,55);
    const eligiblePool=buildCandidateNumberPool(singles,DEFAULT_SETTINGS,50,6);
    const universe=generateCandidateUniverse(singles,pairs,triples,DEFAULT_SETTINGS,training,[...INSIDE_SET],training,50);
    const standard=selectPortfolio(universe,DEFAULT_SETTINGS,50);
    const experimental=selectExperimentalPowerPortfolio(universe,singles,pairs,triples,DEFAULT_SETTINGS,training);
    expect(experimental.slice(0,5).map(item=>item.numbers)).toEqual(standard.slice(0,5).map(item=>item.numbers));
    expect(experimental).toHaveLength(50);
    expect(experimental.map(item=>item.numbers.join("-"))).toEqual(selectExperimentalPowerPortfolio(universe,singles,pairs,triples,DEFAULT_SETTINGS,training).map(item=>item.numbers.join("-")));
    expect(experimental.every(item=>item.valid&&item.numbers.every(number=>number>=1&&number<=55)&&Number.isFinite(item.selectionScore)&&item.selectionScore!>=0&&item.selectionScore!<=100)).toBe(true);
    expect(experimental.slice(0,5).every(item=>item.selectionReason==="score"&&item.selectionScore===round2(item.totalScore))).toBe(true);
    expect(experimental.slice(5).every(item=>item.selectionReason==="coverage"||item.selectionReason==="relaxed-overlap")).toBe(true);
    const numberCounts=Array(56).fill(0);
    experimental.slice(0,5).forEach(item=>item.numbers.forEach(number=>numberCounts[number]++));
    for(const item of experimental.slice(5)){
      const newCount=item.numbers.filter(number=>numberCounts[number]===0).length;
      const diversity=item.numbers.reduce((sum,number)=>sum+1/(1+numberCounts[number]),0)/6;
      expect(item.selectionScore).toBe(round2(80*newCount/6+20*diversity));
      if(newCount===0)expect(item.selectionScore).toBeLessThan(25);
      item.numbers.forEach(number=>numberCounts[number]++);
    }
    expect(experimental.at(-1)?.selectionScore).toBeGreaterThan(0);
    const coverage=calculatePortfolioCoverage(experimental.slice(0,20),55);
    expect(coverage.uniqueNumbers).toBe(eligiblePool.length);
    expect(experimental.every(item=>item.numbers.every(number=>eligiblePool.includes(number)))).toBe(true);
    expect(coverage.mostRepeatedTriple?.ticketCount).toBeGreaterThanOrEqual(1);
  },30000);
  it("uses the same pre-target Power portfolio in single and rolling backtests",()=>{
    const source=(powerHistory.draws as Draw[]).slice(-51);
    const target=source.at(-1)!;
    const options={fromDate:target.date,toDate:target.date,trainingDraws:50,predictionCount:20,maxNumber:55,powerSuggestionMode:"experimental" as const};
    const single=backtestRange(source,DEFAULT_SETTINGS,options);
    const rolling=runPortfolioRollingBacktest(source,DEFAULT_SETTINGS,{...options,predictionCount:20});
    expect(single.rows[0].bestMatches).toBe(rolling.rows[0].bestMatches);
    expect(single.rows[0].predictions).toHaveLength(20);
    const altered=[...source.slice(0,-1),{...target,numbers:[1,2,3,4,5,6] as Draw["numbers"]}];
    expect(backtestRange(altered,DEFAULT_SETTINGS,options).rows[0].predictions.map(item=>item.numbers)).toEqual(single.rows[0].predictions.map(item=>item.numbers));
  },30000);
  it("searches combinations by every entered number",()=>{
    const items=[{numbers:[3,4,19,22,26,33],rank:1},{numbers:[3,10,19,25,34,45],rank:2},{numbers:[2,4,12,16,19,26],rank:3}];
    expect(filterCombinationsByNumbers(items,"03-19").map(item=>item.rank)).toEqual([1,2]);
    expect(filterCombinationsByNumbers(items,"031926").map(item=>item.rank)).toEqual([1]);
    expect(filterCombinationsByNumbers(items,"")).toBe(items);
    expect(filterCombinationsByNumbers(items,"none")).toEqual([]);
  });
  it("applies inclusive score ranges only to matching suggested combinations",()=>{
    const ranges:CombinationScoreRanges={singleScore:{min:"40",max:"50"},pairScore:{min:"",max:"10"},gapScore:{min:"",max:""},structureScore:{min:"",max:""},totalScore:{min:"60",max:""}};
    const items=[
      {singleScore:40,pairScore:10,gapScore:55,structureScore:85,totalScore:60},
      {singleScore:50.01,pairScore:5,gapScore:55,structureScore:85,totalScore:65},
      {singleScore:45,pairScore:11,gapScore:55,structureScore:85,totalScore:65},
    ];
    expect(validCombinationScoreRanges(ranges)).toBe(true);
    expect(filterCombinationsByScores(items,ranges)).toEqual([items[0]]);
    expect(validCombinationScoreRanges({...ranges,singleScore:{min:"51",max:"50"}})).toBe(false);
    expect(validCombinationScoreRanges({...ranges,pairScore:{min:"",max:"101"}})).toBe(false);
  });
  it("parses compact manual combinations and identifies invalid segments",()=>{
    const mega=parseCompactCombinations("101436374143",45);
    expect(mega.valid).toBe(true);
    expect(mega.combinations).toEqual([[10,14,36,37,41,43]]);
    const power=parseCompactCombinations("01 09 10 23 36 53",55);
    expect(power.valid).toBe(true);
    expect(power.combinations).toEqual([[1,9,10,23,36,53]]);
    expect(parseCompactCombinations("101436374153",45).issues.some(issue=>issue.value==="53")).toBe(true);
    expect(parseCompactCombinations("101436",45).issues[0].value).toBe("101436");
  });
  it("loads valid Power 6/55 history with a distinct bonus number",()=>{
    const power=powerHistory.draws as Draw[];
    expect(powerHistory.repository).toBe("https://github.com/NhanAZ-Data/vietlott-research");
    expect(powerHistory.source).toContain("NhanAZ-Data/vietlott-research/main/datasets/draws/power655/all.csv");
    expect(power.length).toBeGreaterThan(1400);
    expect(power.map(draw=>draw.date)).toEqual([...power.map(draw=>draw.date)].sort());
    expect(power.at(-1)?.date).toBe(powerHistory.sourceThrough);
    expect(power.every(draw=>draw.numbers.length===6&&new Set(draw.numbers).size===6&&draw.numbers.every(number=>number>=1&&number<=55)&&draw.bonus!==undefined&&!draw.numbers.includes(draw.bonus)&&Number.isFinite(draw.jackpot)&&Number.isFinite(draw.jackpot2))).toBe(true);
  });
  it("generates valid, scored, diverse candidates", () => { const singles=calculateSingles(draws,DEFAULT_SETTINGS); const pairs=calculatePairs(draws); const triples=calculateTriples(draws); const candidates=generateCandidates(singles,pairs,triples,DEFAULT_SETTINGS); expect(candidates.every(c=>c.valid&&c.numbers.length===6&&Number.isFinite(c.totalScore))).toBe(true); });
  it("scores a combination from the specified subset and empirical structure equations",()=>{
    const source=[draws[0],{...draws[0],id:"repeat"}],singles=calculateSingles(source,DEFAULT_SETTINGS),pairs=calculatePairs(source),triples=calculateTriples(source);
    const [candidate]=scoreCandidateCombinations([[1,2,3,4,5,6]],singles,pairs,triples,DEFAULT_SETTINGS,source);
    const expectedSingle=source[0].numbers.reduce((sum,number)=>{
      const item=singles[number-1];
      return sum+.55*chanceAdjustedSubsetScore(item.totalCount,source.length,1,45,6)+.45*item.pickScore;
    },0)/6;
    expect(candidate.singleScore).toBeCloseTo(expectedSingle,2);
    expect(candidate.structureScore).toBe(100);
    expect(candidate.pairScore).toBeGreaterThan(50);
    expect(candidate.totalScore).toBeGreaterThanOrEqual(0);
    expect(candidate.totalScore).toBeLessThanOrEqual(100);
    expect(candidate.gapScore).toBeGreaterThanOrEqual(0);
    const alteredTriples=scoreCandidateCombinations([[1,2,3,4,5,6]],singles,pairs,triples.map(item=>({...item,count:item.count+20})),DEFAULT_SETTINGS,source)[0];
    expect(alteredTriples).toEqual(candidate);
  });
  it("prefers low overlap and only relaxes the configured cap when necessary",()=>{
    const source=history.draws as Draw[],settings=settingsForPreset(DEFAULT_SETTINGS,"Balanced"),singles=calculateSingles(source,settings),pairs=calculatePairs(source),triples=calculateTriples(source),universe=generateCandidateUniverse(singles,pairs,triples,settings,source),portfolio=selectPortfolio(universe,settings,10);
    expect(portfolio).toHaveLength(10);
    for(let i=0;i<portfolio.length;i++)for(let j=0;j<i;j++){
      const overlap=portfolio[i].numbers.filter(number=>portfolio[j].numbers.includes(number)).length;
      expect(overlap).toBeLessThanOrEqual(settings.maxCombinationOverlap+1);
      if(overlap>settings.maxCombinationOverlap)expect(portfolio[i].selectionReason).toBe("relaxed-overlap");
    }
  },30000);
  it("keeps a viable structure-aware candidate pool with real history", () => { const real=history.draws as Draw[]; const singles=calculateSingles(real,DEFAULT_SETTINGS); const pairs=calculatePairs(real); const triples=calculateTriples(real); expect(generateCandidates(singles,pairs,triples,DEFAULT_SETTINGS).length).toBeGreaterThan(0); });
  it("filters suggested combinations to the configured digital roots",()=>{
    const real=history.draws as Draw[];
    const candidates=generateCandidates(calculateSingles(real,DEFAULT_SETTINGS),calculatePairs(real),calculateTriples(real),DEFAULT_SETTINGS,real);
    expect(DEFAULT_SETTINGS.allowedDigitalRoots).toEqual([1,3,5,6,7,8,9]);
    expect(candidates.every(candidate=>DEFAULT_SETTINGS.allowedDigitalRoots.includes(candidate.digitalRoot))).toBe(true);
    expect(candidates.every(candidate=>DEFAULT_SETTINGS.allowedParity.includes(`${candidate.evenCount}/${candidate.oddCount}`))).toBe(true);
    expect(new Set(candidates.map(candidate=>`${candidate.evenCount}/${candidate.oddCount}`))).toEqual(new Set(DEFAULT_SETTINGS.allowedParity));
  });
  it("can provide 50 suggested combinations",()=>{
    const recent=(history.draws as Draw[]).slice(-100);
    const singles=calculateSingles(recent,DEFAULT_SETTINGS);
    const pairs=calculatePairs(recent);
    const triples=calculateTriples(recent);
    const candidates=generateCandidates(singles,pairs,triples,{...DEFAULT_SETTINGS,topCombinationCount:50},recent);
    expect(candidates).toHaveLength(50);
  });
  it("backtest isolates each target from future data", () => { const result=backtest(draws,DEFAULT_SETTINGS,2); expect(result.tests).toBe(2); expect(result.best).toBeLessThanOrEqual(6); });
  it("evaluates every eligible draw in the selected range",()=>{
    const result=backtestRange(draws,{...DEFAULT_SETTINGS,candidatePoolSize:10},{fromDate:"2026-01-01",toDate:"2026-03-19",trainingDraws:10,predictionCount:2});
    expect(result.rows.map(row=>row.date)).toEqual(draws.filter(draw=>draw.date>="2026-01-01"&&draw.date<="2026-03-19").slice(10).map(draw=>draw.date));
    expect(result.rows.every(row=>row.predictions.length<=2&&row.actual.length===6)).toBe(true);
    expect(result.rows.flatMap(row=>row.predictions).every(prediction=>Number.isFinite(prediction.singleScore)&&Number.isFinite(prediction.pairScore)&&prediction.insideCount+prediction.outsideCount===6&&prediction.evenCount+prediction.oddCount===6)).toBe(true);
    expect(result.distribution.reduce((sum,count)=>sum+count,0)).toBe(result.tests);
    expect(result.skippedTrainingCount).toBe(10);
  });
  it("matches the Suggested combinations portfolio for the same training slice and preset",()=>{
    const target=draws[10],training=draws.slice(0,10),settings={...settingsForPreset(DEFAULT_SETTINGS,"Balanced"),recentDrawCooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:false}};
    const expected=generateSuggestedPortfolio(calculateSingles(training,settings),calculatePairs(training),settings,training,[...INSIDE_SET],2,{numbers:new Set(),mode:"hard",softPenalty:25});
    const actual=backtestRange(draws,settings,{fromDate:target.date,toDate:target.date,trainingDraws:10,predictionCount:2,cooldownEnabled:false}).rows[0].predictions;
    expect(actual.map(item=>[item.numbers,item.totalScore])).toEqual(expected.map(item=>[item.numbers,item.totalScore]));
  });
  it("bounds proposal training to the range, excludes T+0, and keeps it as the local cooldown reference",()=>{
    const target=draws[11],settings={...DEFAULT_SETTINGS,candidatePoolSize:10},cooldown={...DEFAULT_SETTINGS.recentDrawCooldown,enabled:true,mode:"hard" as const,draws:1};
    const result=generateBacktestProposals(draws,settings,{fromDate:draws[1].date,toDate:target.date,trainingDraws:30,predictionCount:2,cooldown});
    expect(result.targetDate).toBe(target.date);
    expect(result.trainingDrawCount).toBe(9);
    expect(result.excludedDrawDate).toBe(draws[10].date);
    expect(result.cooldownReferenceDates).toEqual([draws[10].date]);
    expect(result.actual).toEqual(target.numbers);
    const noTarget=generateBacktestProposals(draws.filter(draw=>draw!==target),settings,{fromDate:draws[1].date,toDate:target.date,trainingDraws:30,predictionCount:2,cooldown});
    expect(noTarget.actual).toEqual(draws[10].numbers);
    expect(noTarget.actualDate).toBe(draws[10].date);
    expect(noTarget.predictions.map(item=>[item.numbers,item.totalScore])).toEqual(result.predictions.map(item=>[item.numbers,item.totalScore]));
  });
  it("keeps manual proposed sets unchanged when local cooldown is enabled",()=>{
    const proposed=[1,2,3,4,7,45],target=draws[11];
    const result=generateBacktestProposals(draws,DEFAULT_SETTINGS,{fromDate:draws[0].date,toDate:target.date,trainingDraws:10,predictionCount:2,manualProposedSets:[proposed],cooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:true}});
    expect(result.predictions.map(item=>item.numbers)).toEqual([proposed]);
    expect(result.cooldownReferenceDates).toEqual([draws[10].date]);
  });
  it("uses at most each selected training window without reaching before From date",()=>{
    const source=history.draws as Draw[],toDate=source.at(-1)!.date,fromDate=source[0].date;
    for(const trainingDraws of [30,50,100]){
      const result=generateBacktestProposals(source,DEFAULT_SETTINGS,{fromDate,toDate,trainingDraws,predictionCount:1,cooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:false}});
      expect(result.trainingDrawCount).toBe(trainingDraws);
    }
    const short=generateBacktestProposals(source,DEFAULT_SETTINGS,{fromDate:source.at(-5)!.date,toDate,trainingDraws:100,predictionCount:1,cooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:false}});
    expect(short.trainingDrawCount).toBe(3);
  });
  it("does not use older draws, target results, or future draws for a target prediction",()=>{
    const target=draws[11],options={fromDate:target.date,toDate:target.date,trainingDraws:10,predictionCount:2,cooldownEnabled:false};
    const future={...target,id:"future",date:"2026-03-26",numbers:[10,20,30,35,40,45]};
    const baseline=backtestRange([...draws,future],DEFAULT_SETTINGS,options).rows[0].predictions.map(item=>[item.numbers,item.totalScore]);
    const changed=[{...draws[0],numbers:[40,41,42,43,44,45]},...draws.slice(1,11),{...target,numbers:[10,20,30,35,40,45]},{...future,numbers:[1,2,3,4,5,6]}];
    const next=backtestRange(changed,DEFAULT_SETTINGS,options).rows[0].predictions.map(item=>[item.numbers,item.totalScore]);
    expect(next).toEqual(baseline);
  });
  it("uses entered sets unchanged against every eligible draw",()=>{
    const proposed=[1,2,3,4,7,45];
    const options={fromDate:"2026-01-01",toDate:"2026-03-19",trainingDraws:10,predictionCount:2};
    const result=backtestRange(draws,DEFAULT_SETTINGS,{...options,manualProposedSets:[proposed]});
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map(row=>row.predictions[0].numbers)).toEqual([proposed,proposed]);
    expect(result.rows.every(row=>row.predictions[0].matches===proposed.filter(number=>row.actual.includes(number)).length)).toBe(true);
  });
  it("runs each comma-separated entered set against every eligible selected draw",()=>{
    const manual=parseCompactCombinations("111721222630,021617263335,192122242835,111216192326",45);
    expect(manual.valid).toBe(true);
    const testDraws=[...draws,...Array.from({length:4},(_,index)=>({...draws[index],id:`extra-${index}`,date:`2026-04-${String(index*7+1).padStart(2,"0")}`}))];
    const result=backtestRange(testDraws,DEFAULT_SETTINGS,{fromDate:"2026-01-01",toDate:"2026-04-30",trainingDraws:10,predictionCount:2,manualProposedSets:manual.combinations});
    expect(result.rows).toHaveLength(6);
    expect(result.rows.at(-1)?.date).toBe("2026-04-22");
    expect(result.rows.at(-1)?.actual).toEqual(testDraws.at(-1)?.numbers);
    expect(result.rows.every(row=>row.predictions.map(prediction=>prediction.numbers).map(set=>set.join("-")).join("|")===manual.combinations.map(set=>set.join("-")).join("|"))).toBe(true);
  });
  it("enables the full training tier supported by the selected range",()=>{
    const repeated=(count:number)=>Array.from({length:count},(_,index)=>({...draws[0],id:String(index).padStart(3,"0"),date:"2026-01-01"}));
    expect(getBacktestTrainingWindows(repeated(30),"2026-01-01","2026-01-01")).toMatchObject({priorDraws:29,windows:[]});
    expect(getBacktestTrainingWindows(repeated(31),"2026-01-01","2026-01-01").windows).toEqual([30]);
    expect(getBacktestTrainingWindows(repeated(51),"2026-01-01","2026-01-01").windows).toEqual([30,50]);
    expect(getBacktestTrainingWindows(repeated(101),"2026-01-01","2026-01-01").windows).toEqual([30,50,100]);
  });
  it("uses full prior history for a short target range and reports rolling eligibility",()=>{
    const source=(history.draws as Draw[]).slice(-106);
    const lastFive=source.slice(-5);
    const fromDate=lastFive[0].date,toDate=lastFive.at(-1)!.date;
    const availability=getBacktestTrainingWindows(source,fromDate,toDate);
    expect(availability.windows).toEqual([30,50,100]);
    expect(availability.rolling[50]).toEqual({eligibleTargetCount:5,skippedTrainingCount:0});
    expect(backtestRange(source,DEFAULT_SETTINGS,{fromDate:toDate,toDate,trainingDraws:100,predictionCount:1}).tests).toBe(1);
  });
  it("selects exact Top K on ties without changing tied percentiles or model agreement",()=>{
    expect([...exactTopNumbers(Array.from({length:45},(_,index)=>({number:index+1,score:50})),10)]).toEqual(Array.from({length:10},(_,index)=>index+1));
    const singles=calculateSingles([],DEFAULT_SETTINGS,45);
    expect(singles.reduce((sum,item)=>sum+item.modelAgreement,0)).toBe(40);
    expect(new Set(singles.map(item=>item.models.gap.percentileRank))).toEqual(new Set([50]));
  });
  it("does not count every dense-rank tie as a Top 10 hit",()=>{
    const repeated=Array.from({length:51},(_,index)=>({id:String(index),date:`2026-01-${String(index+1).padStart(2,"0")}`,numbers:[1,2,3,4,5,6],jackpot:0} as Draw));
    repeated[50]={...repeated[50],numbers:[40,41,42,43,44,45]};
    const result=runRollingBacktest(repeated,DEFAULT_SETTINGS,1);
    expect(result.rows[0].top10).toBe(0);
    expect(result.tieBreak).toBe("score desc, number asc");
  });
  it("uses the survival-style gap score for every preset",()=>{
    const source=(history.draws as Draw[]).slice(-50);
    const legacy=calculateSingles(source,settingsForPreset(DEFAULT_SETTINGS,"Default"));
    const v2=calculateSingles(source,settingsForPreset(DEFAULT_SETTINGS,"Gap + Frequency"));
    expect(legacy.every((item,index)=>item.models.gap.normalizedScore===item.gap.gapScore)).toBe(true);
    expect(v2.every(item=>item.models.gap.normalizedScore===item.gap.gapScore)).toBe(true);
  });
  it("calculates advanced frequency and gap statistics from history",()=>{
    expect(calculateRollingFrequency(draws,1)).toEqual({last10:5,last20:7,last30:7,last50:7,last100:7,all:7});
    expect(calculateWeightedFrequency(draws,1,30)).toBeGreaterThan(0);
    const band=calculateExpectedFrequencyBand(draws.length);
    expect(band.lower95).toBeLessThan(band.expected);expect(band.upper95).toBeGreaterThan(band.expected);
    expect(calculateGapDistribution(draws,1).currentGap).toBe(0);
    expect(calculateChiSquareUniformity(draws).pValue).toBeGreaterThanOrEqual(0);
  });
  it("builds normalized consensus signals and supported lift",()=>{
    const singles=calculateSingles(draws,DEFAULT_SETTINGS);
    expect(singles.every(item=>item.models.consensus.normalizedScore>=0&&item.models.consensus.normalizedScore<=100)).toBe(true);
    expect(singles.every(item=>singles.filter(other=>other.technicalScore===item.technicalScore).every(other=>other.rank===item.rank&&other.models.consensus.percentileRank===item.models.consensus.percentileRank))).toBe(true);
    expect(calculatePairs(draws).find(pair=>pair.key==="01-02")?.lift).toBeGreaterThan(1);
  });
  it("uses bounded midranks and does not invent completed gaps",()=>{
    expect(percentileRank([1,2],3)).toBe(100);
    expect(percentileRank([2,2,2],2)).toBe(50);
    expect(percentileRank([],3)).toBeNull();
    const missing=calculateGapDistribution(draws,55);
    expect(missing.gapCensored).toBe(true);
    expect(missing.currentGap).toBe(draws.length);
    expect(missing.meanGap).toBeNull();
    expect(missing.maxCompletedGap).toBeNull();
    expect(calculateGapDistribution(draws,1).currentGap).toBe(0);
  });
  it("keeps weighted scores scale-invariant and rejects invalid totals",()=>{
    expect(weightedAverage([20,80],[1,3])).toBe(weightedAverage([20,80],[10,30]));
    expect(()=>weightedAverage([20,80],[0,0])).toThrow(RangeError);
    expect(()=>weightedAverage([20,80],[1,-1])).toThrow(RangeError);
  });
  it("filters the full candidate universe without changing main proposals",()=>{
    const real=(history.draws as Draw[]).slice(-50);
    const settings=settingsForPreset(DEFAULT_SETTINGS,"Balanced");
    const singles=calculateSingles(real,settings),pairs=calculatePairs(real),triples=calculateTriples(real);
    const universe=generateCandidateUniverse(singles,pairs,triples,settings,real);
    const main=selectPortfolio(universe,settings,20);
    const original=main.map(item=>[item.numbers.join("-"),item.totalScore]);
    const scores=scoreCandidateCombinations(universe.map(item=>item.numbers),singles,pairs,triples,settings,real);
    const target=universe.find(item=>!main.some(pick=>pick.numbers.join("-")===item.numbers.join("-")))!;
    expect(target).toBeDefined();
    const narrow:CombinationScoreRanges={singleScore:{min:String(target.singleScore),max:String(target.singleScore)},pairScore:{min:String(target.pairScore),max:String(target.pairScore)},gapScore:{min:String(target.gapScore),max:String(target.gapScore)},structureScore:{min:String(target.structureScore),max:String(target.structureScore)},totalScore:{min:String(target.totalScore),max:String(target.totalScore)}};
    const result=selectFilteredPortfolio(universe,scores,main,narrow,settings,20);
    expect(result.rows.some(row=>row.proposal.numbers.join("-")===target.numbers.join("-"))).toBe(true);
    expect(main.map(item=>[item.numbers.join("-"),item.totalScore])).toEqual(original);
    expect(scores[0]).not.toBe(universe[0]);
  });
  it("measures portfolio coverage only from displayed tickets",()=>{
    const real=(history.draws as Draw[]).slice(-50);
    const main=generateCandidates(calculateSingles(real,DEFAULT_SETTINGS),calculatePairs(real),calculateTriples(real),DEFAULT_SETTINGS,real);
    const coverage=calculatePortfolioCoverage(main.slice(0,5),45);
    expect(coverage.ticketCount).toBe(5);
    expect(coverage.numberCounts.reduce((sum,item)=>sum+item.count,0)).toBe(30);
    expect(coverage.uniquePairs).toBeLessThanOrEqual(75);
    expect(coverage.uniqueTriples).toBeLessThanOrEqual(100);
  });
  it("keeps pre-start training and includes zero-ticket targets in rolling denominators",()=>{
    const real=(history.draws as Draw[]).slice(-52);
    const result=runPortfolioRollingBacktest(real,DEFAULT_SETTINGS,{fromDate:real[50].date,toDate:real[51].date,predictionCount:5,maxNumber:45});
    expect(result.evaluatedTargetCount).toBe(2);
    expect(result.skippedTrainingCount).toBe(0);
    expect(result.distribution.reduce((sum,count)=>sum+count,0)).toBe(2);
    const constrained=runPortfolioRollingBacktest(real,{...DEFAULT_SETTINGS,allowedDigitalRoots:[]},{fromDate:real[50].date,toDate:real[50].date,predictionCount:5,maxNumber:45});
    expect(constrained.evaluatedTargetCount).toBe(1);
    expect(constrained.minimumTicketCount).toBe(0);
    expect(constrained.distribution[0]).toBe(1);
  });
  it("uses a reproducible random baseline without future leakage",()=>{
    const a=runRollingBacktest(draws,{...DEFAULT_SETTINGS,backtestMinTrainingDraws:6},4,123);
    const b=runRollingBacktest(draws,{...DEFAULT_SETTINGS,backtestMinTrainingDraws:6},4,123);
    expect(a).toEqual(b);expect(a.tests).toBe(4);
  });
  it("applies V2 scoring presets to consensus and top predictions",()=>{
    const real=history.draws as Draw[];
    const gapSettings=settingsForPreset(DEFAULT_SETTINGS,"Gap + Frequency");
    const pairSettings=settingsForPreset(DEFAULT_SETTINGS,"Pair");
    expect(gapSettings.consensusWeights.gap).toBe(65);
    expect(pairSettings.comboWeightsV2.pair).toBe(42);
    for(const preset of ["Default","Balanced","Hot","Legacy Gap","Gap + Frequency","Pair"]){
      const weights=Object.values(settingsForPreset(DEFAULT_SETTINGS,preset).comboWeightsV2);
      expect(weights.reduce((sum,value)=>sum+value,0)).toBe(100);
      expect(settingsForPreset(DEFAULT_SETTINGS,preset).comboWeightsV2).not.toHaveProperty("triple");
    }
    const pairs=calculatePairs(real),triples=calculateTriples(real);
    const defaultTop=generateCandidates(calculateSingles(real,DEFAULT_SETTINGS),pairs,triples,DEFAULT_SETTINGS,real).slice(0,5).map(item=>item.numbers.join("-")).join("|");
    const gapTop=generateCandidates(calculateSingles(real,gapSettings),pairs,triples,gapSettings,real).slice(0,5).map(item=>item.numbers.join("-")).join("|");
    expect(gapTop).not.toBe(defaultTop);
  });
});
