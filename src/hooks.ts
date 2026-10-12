import { useMemo } from "react";
import { calculatePairs, calculateSingles, calculateTriples, filterDraws, generateCandidateUniverse, selectPortfolio } from "./analytics";
import { useLotteryStore } from "./store";
import type { AnalysisSettings } from "./domain";
import { DEFAULT_SETTINGS, LOTTERY_GAMES } from "./domain";

export function settingsForPreset(settings: AnalysisSettings, preset: string):AnalysisSettings {
  if (preset === "Custom") return settings;
  if (preset === "Default") return {...settings,gapModelVersion:"legacy",consensusWeights:{...DEFAULT_SETTINGS.consensusWeights},comboWeightsV2:{...DEFAULT_SETTINGS.comboWeightsV2}};
  if (preset === "Balanced") return { ...settings,gapModelVersion:"legacy", consensusWeights:{frequency:25,momentum:25,gap:25,association:25}, comboWeightsV2:{consensus:35,pair:20,triple:5,structure:25,novelty:15} };
  if (preset === "Hot") return { ...settings,gapModelVersion:"legacy", consensusWeights:{frequency:25,momentum:55,gap:5,association:15}, comboWeightsV2:{consensus:45,pair:15,triple:5,structure:20,novelty:15} };
  if (preset === "Gap + Frequency") return { ...settings,gapModelVersion:"v2",consensusWeights:{frequency:25,momentum:5,gap:65,association:5},comboWeightsV2:{consensus:45,pair:10,triple:5,structure:25,novelty:15} };
  if (preset === "Pair") return { ...settings,gapModelVersion:"legacy", consensusWeights:{frequency:15,momentum:10,gap:10,association:65}, comboWeightsV2:{consensus:25,pair:45,triple:5,structure:15,novelty:10} };
  if (preset === "Triple") return { ...settings,gapModelVersion:"legacy", consensusWeights:{frequency:20,momentum:10,gap:10,association:60}, comboWeightsV2:{consensus:25,pair:15,triple:40,structure:10,novelty:10} };
  return settings;
}

export function useAnalytics(topCombinationCount?:number, skipPredictions=false) {
  const { draws:megaDraws, powerDraws, selectedGame, settings, dashboardFilters } = useLotteryStore();
  const {period,fromDate,toDate,scoringPreset}=dashboardFilters;
  const stats=useMemo(() => {
    const gameConfig=LOTTERY_GAMES[selectedGame];
    const draws=selectedGame==="power655"?powerDraws:megaDraws;
    const effectiveSettings = settingsForPreset(settings, scoringPreset);
    const filtered = filterDraws(draws, period, fromDate, toDate);
    const singles = calculateSingles(filtered, effectiveSettings,gameConfig.maxNumber);
    const pairs = calculatePairs(filtered,gameConfig.maxNumber);
    const triples = calculateTriples(filtered,gameConfig.maxNumber);
    return { draws,filtered,singles,pairs,triples,selectedGame,gameConfig,effectiveSettings };
  }, [megaDraws,powerDraws,selectedGame,settings,period,fromDate,toDate,scoringPreset]);
  const candidateUniverse=useMemo(()=>skipPredictions?[]:generateCandidateUniverse(stats.singles,stats.pairs,stats.triples,stats.effectiveSettings,stats.filtered),[stats,skipPredictions]);
  const predictions=useMemo(()=>skipPredictions?[]:selectPortfolio(candidateUniverse,stats.effectiveSettings,Math.max(50,topCombinationCount??0)),[candidateUniverse,stats.effectiveSettings,topCombinationCount,skipPredictions]);
  return {...stats,candidateUniverse,predictions};
}
