import { useMemo } from "react";
import { buildCandidateNumberPool, buildRecentDrawCooldownSet, calculatePairs, calculateSingles, calculateTriples, filterDraws, generateCandidateUniverse, selectExperimentalPowerPortfolio, selectPortfolio } from "./analytics";
import { useLotteryStore } from "./store";
import type { AnalysisSettings } from "./domain";
import { DEFAULT_SETTINGS, LOTTERY_GAMES } from "./domain";

export function settingsForPreset(settings: AnalysisSettings, preset: string):AnalysisSettings {
  if (preset === "Custom") return settings;
  if (preset === "Default") return {...settings,gapModelVersion:"legacy",singleScoreWeights:{...DEFAULT_SETTINGS.singleScoreWeights},consensusWeights:{...DEFAULT_SETTINGS.consensusWeights},comboWeightsV2:{...DEFAULT_SETTINGS.comboWeightsV2}};
  if (preset === "Balanced") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:30,zScore:25,momentum:20,gap:25},consensusWeights:{frequency:25,momentum:25,gap:25,association:25},comboWeightsV2:{single:32,pair:25,gap:20,structure:13,novelty:10} };
  if (preset === "Hot") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:45,zScore:20,momentum:30,gap:5},consensusWeights:{frequency:25,momentum:55,gap:5,association:15},comboWeightsV2:{single:42,pair:22,gap:22,structure:8,novelty:6} };
  if (preset === "Gap" || preset === "Legacy Gap") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:20,zScore:15,momentum:10,gap:55},consensusWeights:{frequency:10,momentum:10,gap:65,association:15},comboWeightsV2:{single:28,pair:18,gap:40,structure:8,novelty:6} };
  if (preset === "Gap+Freq" || preset === "Gap + Frequency") return { ...settings,gapModelVersion:"v2",singleScoreWeights:{frequency:35,zScore:15,momentum:15,gap:35},consensusWeights:{frequency:25,momentum:5,gap:65,association:5},comboWeightsV2:{single:32,pair:18,gap:35,structure:8,novelty:7} };
  if (preset === "Pair") return { ...settings,gapModelVersion:"legacy",singleScoreWeights:{frequency:30,zScore:25,momentum:20,gap:25},consensusWeights:{frequency:15,momentum:10,gap:10,association:65},comboWeightsV2:{single:25,pair:42,gap:15,structure:10,novelty:8} };
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
  const cooldown=useMemo(()=>{
    const configured=stats.effectiveSettings.recentDrawCooldown,config=selectedGame==="lotto535"?{...configured,enabled:false}:configured,numbers=buildRecentDrawCooldownSet(stats.draws,config);
    const base={numbers,mode:config.mode,softPenalty:config.softPenalty};
    const fallback=config.enabled&&config.mode==="hard"&&buildCandidateNumberPool(stats.singles,stats.effectiveSettings,stats.effectiveSettings.topCombinationCount,stats.gameConfig.drawSize,base).length<stats.gameConfig.drawSize;
    return {...base,mode:fallback?"soft" as const:config.mode,fallback};
  },[stats.draws,stats.singles,stats.effectiveSettings,stats.gameConfig.drawSize,selectedGame]);
  const requestedCount=Math.max(dashboardFilters.predictionCount,topCombinationCount??0);
  const candidatePoolRequest=requestedCount>=5?5:requestedCount;
  const candidateUniverse=useMemo(()=>skipPredictions?[]:generateCandidateUniverse(stats.singles,stats.pairs,stats.triples,stats.effectiveSettings,stats.filtered,stats.gameConfig.insideNumbers,stats.draws,candidatePoolRequest,cooldown),[stats,skipPredictions,candidatePoolRequest,cooldown]);
  const predictions=useMemo(()=>{
    if(skipPredictions)return [];
    const select=(candidates:typeof candidateUniverse,allowRelaxedOverlap=false)=>selectedGame==="power655"&&powerSuggestionMode==="experimental"?selectExperimentalPowerPortfolio(candidates,stats.singles,stats.pairs,stats.triples,stats.effectiveSettings,stats.filtered,requestedCount,stats.draws,stats.gameConfig.insideNumbers,allowRelaxedOverlap,cooldown):selectPortfolio(candidates,stats.effectiveSettings,requestedCount,allowRelaxedOverlap);
    let result=select(candidateUniverse);
    if(result.length<requestedCount){
      const expandedSettings={...stats.effectiveSettings,candidatePoolSize:Math.min(stats.gameConfig.maxNumber,stats.effectiveSettings.candidatePoolSize+4)};
      const expanded=generateCandidateUniverse(stats.singles,stats.pairs,stats.triples,expandedSettings,stats.filtered,stats.gameConfig.insideNumbers,stats.draws,candidatePoolRequest,cooldown);
      const candidates=[...new Map([...candidateUniverse,...expanded].map(item=>[item.numbers.join("-"),item])).values()];
      result=select(candidates,true);
    }
    return result;
  },[candidateUniverse,stats,selectedGame,powerSuggestionMode,requestedCount,candidatePoolRequest,skipPredictions,cooldown]);
  return {...stats,candidateUniverse,predictions,cooldownNumbers:cooldown.numbers,cooldownMode:cooldown.mode,cooldownFallback:cooldown.fallback};
}
