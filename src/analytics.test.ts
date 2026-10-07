import { describe, expect, it } from "vitest";
import { backtest, backtestRange, calculateChiSquareUniformity, calculateExpectedFrequencyBand, calculateGapDistribution, calculateMonthlyDraws, calculateOccurrenceTimeline, calculatePairs, calculateRollingFrequency, calculateSingles, calculateTriples, calculateWeightedFrequency, digitalRoot, filterCombinationsByNumbers, filterCompleteCalendarMonths, filterDraws, generateCandidates, parseCompactCombinations, round2, runRollingBacktest } from "./analytics";
import { DEFAULT_SETTINGS, INSIDE_SET } from "./domain";
import type { Draw } from "./domain";
import history from "./data/mega645-history.json";
import powerHistory from "./data/power655-history.json";
import { settingsForPreset } from "./hooks";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";

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
  it("filters periods without changing order", () => expect(filterDraws(draws,"last10").map(d=>d.id)).toEqual(draws.slice(-10).map(d=>d.id)));
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
  it("builds a per-draw historical-frequency timeline with MA20", () => {
    const timeline=calculateOccurrenceTimeline(history.draws as Draw[]);
    expect(timeline).toHaveLength(history.draws.length);
    expect(new Set(timeline.map(x=>x.historicalFrequency)).size).toBeGreaterThan(1);
    expect(timeline.every(x=>Number.isFinite(x.ma20))).toBe(true);
    expect(timeline.at(-1)?.ma20).toBe(round2(timeline.slice(-20).reduce((sum,item)=>sum+item.historicalFrequency,0)/20));
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
  it("searches combinations by every entered number",()=>{
    const items=[{numbers:[3,4,19,22,26,33],rank:1},{numbers:[3,10,19,25,34,45],rank:2},{numbers:[2,4,12,16,19,26],rank:3}];
    expect(filterCombinationsByNumbers(items,"03-19").map(item=>item.rank)).toEqual([1,2]);
    expect(filterCombinationsByNumbers(items,"031926").map(item=>item.rank)).toEqual([1]);
    expect(filterCombinationsByNumbers(items,"")).toBe(items);
    expect(filterCombinationsByNumbers(items,"none")).toEqual([]);
  });
  it("parses compact manual combinations and identifies invalid segments",()=>{
    const mega=parseCompactCombinations("093653, 102301",45);
    expect(mega.valid).toBe(false);
    expect(mega.issues.some(issue=>issue.value==="53")).toBe(true);
    const power=parseCompactCombinations("093653, 102301",55);
    expect(power.valid).toBe(true);
    expect(power.combinations).toEqual([[1,9,10,23,36,53]]);
    expect(parseCompactCombinations("09365, 102301",55).issues[0].value).toBe("09365");
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
  it("keeps a viable structure-aware candidate pool with real history", () => { const real=history.draws as Draw[]; const singles=calculateSingles(real,DEFAULT_SETTINGS); const pairs=calculatePairs(real); const triples=calculateTriples(real); expect(generateCandidates(singles,pairs,triples,DEFAULT_SETTINGS).length).toBeGreaterThan(0); });
  it("backtest isolates each target from future data", () => { const result=backtest(draws,DEFAULT_SETTINGS,2); expect(result.tests).toBe(2); expect(result.best).toBeLessThanOrEqual(6); });
  it("backtests only eligible targets in the selected date range",()=>{
    const result=backtestRange(draws,{...DEFAULT_SETTINGS,candidatePoolSize:10},{fromDate:"2026-03-05",toDate:"2026-03-19",trainingDraws:10,predictionCount:2});
    expect(result.rows.map(row=>row.date)).toEqual(["2026-03-12","2026-03-19"]);
    expect(result.rows.every(row=>row.predictions.length<=2&&row.actual.length===6)).toBe(true);
    expect(result.rows.flatMap(row=>row.predictions).every(prediction=>Number.isFinite(prediction.tripleScore)&&prediction.insideCount+prediction.outsideCount===6&&prediction.evenCount+prediction.oddCount===6)).toBe(true);
    expect(result.distribution.reduce((sum,count)=>sum+count,0)).toBe(result.tests);
  });
  it("scores user-entered combinations in a historical backtest",()=>{
    const manual=[1,2,3,4,7,45];
    const result=backtestRange(draws,DEFAULT_SETTINGS,{fromDate:"2026-03-19",toDate:"2026-03-19",trainingDraws:10,predictionCount:5,manualCombinations:[manual]});
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].predictions[0].numbers).toEqual(manual);
    expect(result.rows[0].predictions[0].matches).toBe(6);
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
    expect(new Set(singles.map(item=>item.models.consensus.rank)).size).toBe(45);
    expect(calculatePairs(draws).find(pair=>pair.key==="01-02")?.lift).toBeGreaterThan(1);
  });
  it("uses a reproducible random baseline without future leakage",()=>{
    const a=runRollingBacktest(draws,{...DEFAULT_SETTINGS,backtestMinTrainingDraws:6},4,123);
    const b=runRollingBacktest(draws,{...DEFAULT_SETTINGS,backtestMinTrainingDraws:6},4,123);
    expect(a).toEqual(b);expect(a.tests).toBe(4);
  });
  it("applies V2 scoring presets to consensus and top predictions",()=>{
    const real=history.draws as Draw[];
    const gapSettings=settingsForPreset(DEFAULT_SETTINGS,"Gap");
    const pairSettings=settingsForPreset(DEFAULT_SETTINGS,"Pair");
    expect(gapSettings.consensusWeights.gap).toBe(65);
    expect(pairSettings.comboWeightsV2.pair).toBe(45);
    const pairs=calculatePairs(real),triples=calculateTriples(real);
    const defaultTop=generateCandidates(calculateSingles(real,DEFAULT_SETTINGS),pairs,triples,DEFAULT_SETTINGS,real).slice(0,5).map(item=>item.numbers.join("-")).join("|");
    const gapTop=generateCandidates(calculateSingles(real,gapSettings),pairs,triples,gapSettings,real).slice(0,5).map(item=>item.numbers.join("-")).join("|");
    expect(gapTop).not.toBe(defaultTop);
  });
});
