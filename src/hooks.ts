import { useMemo } from "react";
import { calculatePairs, calculateSingles, calculateTriples, filterDraws, generateCandidateUniverse, selectExperimentalPowerPortfolio, selectPortfolio } from "./analytics";
import { useLotteryStore } from "./store";
import type { AnalysisSettings } from "./domain";
import { DEFAULT_SETTINGS, LOTTERY_GAMES } from "./domain";

export function settingsForPreset(settings: AnalysisSettings, preset: string):AnalysisSettings {
  if (preset === "Custom") return settings;
  if (preset === "Default") return {...settings,gapModelVersion:"legacy",singleScoreWeights:{...DEFAULT_SETTINGS.singleScoreWeights},consensusWeights:{...DEFAULT_SETTINGS.consensusWeights},comboWeightsV2:{...DEFAULT_SETTINGS.comboWeightsV2}};
  if (preset === "Balanced") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:30,zScore:25,momentum:20,gap:25},consensusWeights:{frequency:25,momentum:25,gap:25,association:25},comboWeightsV2:{single:32,pair:25,gap:20,structure:13,novelty:10} };
  if (preset === "Hot") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:45,zScore:20,momentum:30,gap:5},consensusWeights:{frequency:25,momentum:55,gap:5,association:15},comboWeightsV2:{single:45,pair:25,gap:8,structure:10,novelty:12} };
  if (preset === "Gap" || preset === "Legacy Gap" || preset === "Gap + Frequency") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:20,zScore:15,momentum:10,gap:55},consensusWeights:{frequency:10,momentum:10,gap:65,association:15},comboWeightsV2:{single:28,pair:18,gap:38,structure:8,novelty:8} };
  if (preset === "Pair") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:30,zScore:25,momentum:20,gap:25},consensusWeights:{frequency:15,momentum:10,gap:10,association:65},comboWeightsV2:{single:25,pair:42,gap:15,structure:10,novelty:8} };
  if (preset === "Triple") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:30,zScore:25,momentum:20,gap:25},consensusWeights:{frequency:20,momentum:10,gap:10,association:60},comboWeightsV2:{single:38,pair:28,gap:18,structure:10,novelty:6} };
  return settings;
}

export function useAnalytics(topCombinationCount?:number, skipPredictions=false) {
  const { draws:megaDraws, powerDraws, lottoDraws, selectedGame, settings, dashboardFilters, powerSuggestionMode } = useLotteryStore();
  const {period,fromDate,toDate,scoringPreset}=dashboardFilters;
  const stats=useMemo(() => {
    const gameConfig=LOTTERY_GAMES[selectedGame];
    const draws=selectedGame==="mega645"?megaDraws:selectedGame==="power655"?powerDraws:lottoDraws;
    const effectiveSettings = settingsForPreset(settings, scoringPreset);
    const filtered = filterDraws(draws, period, fromDate, toDate);
    const singles = calculateSingles(filtered,effectiveSettings,gameConfig.maxNumber,gameConfig.insideNumbers,period);
    const pairs = calculatePairs(filtered,gameConfig.maxNumber,gameConfig.insideNumbers);
    const triples = calculateTriples(filtered,gameConfig.maxNumber,gameConfig.insideNumbers);
    return { draws,filtered,singles,pairs,triples,selectedGame,gameConfig,effectiveSettings };
  }, [megaDraws,powerDraws,lottoDraws,selectedGame,settings,period,fromDate,toDate,scoringPreset]);
  const requestedCount=Math.max(dashboardFilters.predictionCount,topCombinationCount??0);
  const candidatePoolRequest=requestedCount>=5?5:requestedCount;
  const candidateUniverse=useMemo(()=>skipPredictions?[]:generateCandidateUniverse(stats.singles,stats.pairs,stats.triples,stats.effectiveSettings,stats.filtered,stats.gameConfig.insideNumbers,stats.draws,candidatePoolRequest),[stats,skipPredictions,candidatePoolRequest]);
  const predictions=useMemo(()=>skipPredictions?[]:selectedGame==="power655"&&powerSuggestionMode==="experimental"?selectExperimentalPowerPortfolio(candidateUniverse,stats.singles,stats.pairs,stats.triples,stats.effectiveSettings,stats.filtered,requestedCount,stats.draws,stats.gameConfig.insideNumbers):selectPortfolio(candidateUniverse,stats.effectiveSettings,requestedCount),[candidateUniverse,stats,selectedGame,powerSuggestionMode,requestedCount,skipPredictions]);
  return {...stats,candidateUniverse,predictions};
}
