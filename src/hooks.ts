import { useMemo } from "react";
import { calculatePairs, calculateSingles, calculateTriples, filterDraws, generateCandidates } from "./analytics";
import { useLotteryStore } from "./store";
import type { AnalysisSettings } from "./domain";
import { DEFAULT_SETTINGS, LOTTERY_GAMES } from "./domain";

export function settingsForPreset(settings: AnalysisSettings, preset: string):AnalysisSettings {
  if (preset === "Custom") return settings;
  if (preset === "Default") return {...settings,consensusWeights:{...DEFAULT_SETTINGS.consensusWeights},comboWeightsV2:{...DEFAULT_SETTINGS.comboWeightsV2}};
  if (preset === "Balanced") return { ...settings, consensusWeights:{frequency:25,momentum:25,gap:25,association:25}, comboWeightsV2:{consensus:35,pair:20,triple:5,structure:25,novelty:15} };
  if (preset === "Hot") return { ...settings, consensusWeights:{frequency:25,momentum:55,gap:5,association:15}, comboWeightsV2:{consensus:45,pair:15,triple:5,structure:20,novelty:15} };
  if (preset === "Gap") return { ...settings, consensusWeights:{frequency:10,momentum:10,gap:65,association:15}, comboWeightsV2:{consensus:45,pair:10,triple:5,structure:25,novelty:15} };
  if (preset === "Pair") return { ...settings, consensusWeights:{frequency:15,momentum:10,gap:10,association:65}, comboWeightsV2:{consensus:25,pair:45,triple:5,structure:15,novelty:10} };
  if (preset === "Triple") return { ...settings, consensusWeights:{frequency:20,momentum:10,gap:10,association:60}, comboWeightsV2:{consensus:25,pair:15,triple:40,structure:10,novelty:10} };
  return settings;
}

export function useAnalytics() {
  const { draws:megaDraws, powerDraws, selectedGame, settings, dashboardFilters } = useLotteryStore();
  return useMemo(() => {
    const gameConfig=LOTTERY_GAMES[selectedGame];
    const draws=selectedGame==="power655"?powerDraws:megaDraws;
    const effectiveSettings = settingsForPreset(settings, dashboardFilters.scoringPreset);
    const filtered = filterDraws(draws, dashboardFilters.period, dashboardFilters.fromDate, dashboardFilters.toDate);
    const singles = calculateSingles(filtered, effectiveSettings,gameConfig.maxNumber);
    const pairs = calculatePairs(filtered,gameConfig.maxNumber);
    const triples = calculateTriples(filtered,gameConfig.maxNumber);
    const predictions = generateCandidates(singles, pairs, triples, effectiveSettings, filtered);
    return { draws,filtered,singles,pairs,triples,predictions,selectedGame,gameConfig };
  }, [megaDraws,powerDraws,selectedGame,settings,dashboardFilters]);
}
