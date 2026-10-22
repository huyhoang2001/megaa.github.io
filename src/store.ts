import { create } from "zustand";
import { persist } from "zustand/middleware";
import history from "./data/mega645-history.json";
import powerHistory from "./data/power655-history.json";
import lottoHistory from "./data/lotto535-history.json";
import settingsJson from "./data/default-settings.json";
import type { AnalysisSettings, DashboardFilters, Draw, IndependentFilterConfig, LanguageMode, LotteryGame, PeriodPreset, PowerSuggestionMode, ThemeMode } from "./domain";
import { DEFAULT_FILTERS, DEFAULT_INDEPENDENT_FILTER, LOTTERY_GAMES } from "./domain";

type State = {
  draws: Draw[];
  powerDraws: Draw[];
  lottoDraws: Draw[];
  selectedGame: LotteryGame;
  powerSuggestionMode:PowerSuggestionMode;
  settings: AnalysisSettings;
  gameSettings:Record<LotteryGame,AnalysisSettings>;
  dashboardFilters: DashboardFilters;
  gamePeriods:Record<LotteryGame,PeriodPreset>;
  independentFilterConfig: IndependentFilterConfig;
  gameFilterConfigs:Record<LotteryGame,IndependentFilterConfig>;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  addDraw: (draw: Draw) => void;
  updateDraw: (id: string, draw: Draw) => void;
  removeDraw: (id: string) => void;
  importData: (data: { draws: Draw[]; settings?: AnalysisSettings }) => void;
  resetData: () => void;
  resetSettings: () => void;
  updateSettings: (settings: Partial<AnalysisSettings>) => void;
  updateDashboardFilters: (filters: Partial<DashboardFilters>) => void;
  updateIndependentFilterConfig: (config: Partial<IndependentFilterConfig>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguageMode: (mode: LanguageMode) => void;
  setSelectedGame: (game: LotteryGame) => void;
  setPowerSuggestionMode:(mode:PowerSuggestionMode)=>void;
};

const defaultDraws = history.draws as Draw[];
const defaultPowerDraws = powerHistory.draws as Draw[];
const defaultLottoDraws = lottoHistory.draws as Draw[];
const defaultSettings = settingsJson as AnalysisSettings;
const defaultLottoSettings={...defaultSettings,minTotal:35,candidatePoolSize:14,maxCombinationOverlap:3,allowedParity:["3/2","2/3"],allowedInsideOutside:["3/2","4/1","2/3"],recentDrawCooldown:{...defaultSettings.recentDrawCooldown,enabled:false}};
const previousDefaultRoots=[[8,5,3,1],[1,2,3,4,5,6,7,8,9]];
const previousDefaultParity=["3/3","4/2","2/4"];
const selectablePeriods=new Set<DashboardFilters["period"]>(["last30","last50","last100","last1year","all"]);
export const normalizeDashboardFilters=(filters?:Partial<DashboardFilters>):DashboardFilters=>{
  const merged={...DEFAULT_FILTERS,...filters};
  const scoringPreset=merged.scoringPreset==="Legacy Gap"?"Gap":merged.scoringPreset==="Gap + Frequency"?"Gap+Freq":merged.scoringPreset==="Triple"?"Default":merged.scoringPreset;
  return {...merged,period:selectablePeriods.has(merged.period)?merged.period:DEFAULT_FILTERS.period,scoringPreset};
};
export const mergeBundledDraws=(stored:Draw[]|undefined,bundledDraws:Draw[]):Draw[]=>{
  if(!stored?.length)return bundledDraws;
  const storedById=new Map(stored.map(draw=>[draw.id,draw]));
  const bundledIds=new Set(bundledDraws.map(draw=>draw.id));
  const official=bundledDraws.map(bundled=>{
    const saved=storedById.get(bundled.id);
    if(!saved)return bundled;
    return {
      ...bundled,
      ...saved,
      bonus:saved.bonus??bundled.bonus,
      jackpot:saved.jackpot>0?saved.jackpot:bundled.jackpot,
      jackpot2:saved.jackpot2&&saved.jackpot2>0?saved.jackpot2:bundled.jackpot2,
    };
  });
  return [...official,...stored.filter(draw=>!bundledIds.has(draw.id))].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
};
export const mergeBundledPowerDraws=(stored?:Draw[]):Draw[]=>mergeBundledDraws(stored,defaultPowerDraws);
export const mergeSettings=(settings?:Partial<AnalysisSettings>,defaults:AnalysisSettings=defaultSettings):AnalysisSettings=>{
  const cooldown=settings?.recentDrawCooldown;
  return ({
  ...defaults,...settings,
  singleWeights:{...defaults.singleWeights,...settings?.singleWeights},
  combinationWeights:{...defaults.combinationWeights,...settings?.combinationWeights},
  allowedParity:settings?.allowedParity&&previousDefaultParity.length===settings.allowedParity.length&&previousDefaultParity.every(value=>settings.allowedParity!.includes(value))?[...defaults.allowedParity]:settings?.allowedParity?.filter(value=>defaults.allowedParity.includes(value)).length?settings.allowedParity.filter(value=>defaults.allowedParity.includes(value)):[...defaults.allowedParity],
  allowedDigitalRoots:settings?.allowedDigitalRoots&&previousDefaultRoots.some(roots=>settings.allowedDigitalRoots!.length===roots.length&&roots.every(root=>settings.allowedDigitalRoots!.includes(root)))?defaults.allowedDigitalRoots:[...(settings?.allowedDigitalRoots??defaults.allowedDigitalRoots)],
  consensusWeights:{...defaults.consensusWeights,...settings?.consensusWeights},
  singleScoreWeights:{...defaults.singleScoreWeights,...settings?.singleScoreWeights},
  comboWeightsV2:settings?.comboWeightsV2?.single!==undefined?{...defaults.comboWeightsV2,...settings.comboWeightsV2}:settings?.comboWeightsV2?{single:(settings.comboWeightsV2 as AnalysisSettings["comboWeightsV2"]&{consensus?:number}).consensus??defaults.comboWeightsV2.single,pair:settings.comboWeightsV2.pair??defaults.comboWeightsV2.pair,gap:(settings.comboWeightsV2 as AnalysisSettings["comboWeightsV2"]&{triple?:number}).triple??defaults.comboWeightsV2.gap,structure:settings.comboWeightsV2.structure??defaults.comboWeightsV2.structure,novelty:settings.comboWeightsV2.novelty??defaults.comboWeightsV2.novelty}:{...defaults.comboWeightsV2},
  recentDrawCooldown:{enabled:typeof cooldown?.enabled==="boolean"?cooldown.enabled:defaults.recentDrawCooldown.enabled,draws:typeof cooldown?.draws==="number"&&Number.isInteger(cooldown.draws)&&cooldown.draws>=1&&cooldown.draws<=10?cooldown.draws:defaults.recentDrawCooldown.draws,mode:cooldown?.mode==="soft"?"soft":cooldown?.mode==="hard"?"hard":defaults.recentDrawCooldown.mode,includeBonus:typeof cooldown?.includeBonus==="boolean"?cooldown.includeBonus:defaults.recentDrawCooldown.includeBonus,softPenalty:typeof cooldown?.softPenalty==="number"&&Number.isFinite(cooldown.softPenalty)&&cooldown.softPenalty>=0&&cooldown.softPenalty<=50?cooldown.softPenalty:defaults.recentDrawCooldown.softPenalty},
  });
};
export const validSettings=(settings:AnalysisSettings,maxNumber=55,drawSize=6)=>{
  const integer=(value:number,min:number,max:number)=>Number.isInteger(value)&&value>=min&&value<=max;
  const weights=(values:Record<string,number>)=>Object.values(values).every(value=>Number.isFinite(value)&&value>=0)&&Object.values(values).some(value=>value>0);
  const cooldown=settings.recentDrawCooldown;
  return Number.isSafeInteger(settings.candidatePoolSize)&&settings.candidatePoolSize>0&&integer(settings.minTotal,0,drawSize*maxNumber-drawSize*(drawSize-1)/2)&&integer(settings.maxCombinationOverlap,0,drawSize-1)&&Number.isFinite(settings.weightedFrequencyHalfLife)&&settings.weightedFrequencyHalfLife>0&&integer(settings.minPairSupport,1,10000)&&integer(settings.minCompletedGaps??4,1,10000)&&weights(settings.consensusWeights)&&weights(settings.singleScoreWeights)&&weights(settings.comboWeightsV2)&&typeof cooldown?.enabled==="boolean"&&integer(cooldown.draws,1,10)&&(cooldown.mode==="hard"||cooldown.mode==="soft")&&typeof cooldown.includeBonus==="boolean"&&Number.isFinite(cooldown.softPenalty)&&cooldown.softPenalty>=0&&cooldown.softPenalty<=50;
};
const normalizeFilterConfig=(config?:Partial<IndependentFilterConfig>):IndependentFilterConfig=>({...DEFAULT_INDEPENDENT_FILTER,...config,ranges:{...DEFAULT_INDEPENDENT_FILTER.ranges,...config?.ranges},preset:config?.preset==="Legacy Gap"||config?.preset==="Gap"?"Gap":config?.preset==="Gap + Frequency"?"Gap+Freq":config?.preset==="Triple"?"Default":config?.preset??DEFAULT_INDEPENDENT_FILTER.preset});
export const validDraws=(draws:Draw[],game:LotteryGame|number)=>{
  const config=typeof game==="number"?LOTTERY_GAMES[game===55?"power655":"mega645"]:LOTTERY_GAMES[game];
  const {maxNumber,drawSize,specialMax}=config;
  const ids=new Set<string>();
  return draws.length>0&&draws.every(draw=>{
    if(!draw.id||ids.has(draw.id)||!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)||!Number.isFinite(Date.parse(`${draw.date}T00:00:00Z`))||new Date(`${draw.date}T00:00:00Z`).toISOString().slice(0,10)!==draw.date)return false;
    ids.add(draw.id);
    return draw.numbers.length===drawSize&&new Set(draw.numbers).size===drawSize&&draw.numbers.every(number=>Number.isInteger(number)&&number>=1&&number<=maxNumber)&&Number.isFinite(draw.jackpot)&&draw.jackpot>=0&&(specialMax===0?draw.bonus===undefined:Number.isInteger(draw.bonus)&&draw.bonus!>=1&&draw.bonus!<=specialMax&&(config.id==="lotto535"||!draw.numbers.includes(draw.bonus!)));
  });
};

export const useLotteryStore = create<State>()(persist((set) => ({
  draws: defaultDraws,
  powerDraws: defaultPowerDraws,
  lottoDraws: defaultLottoDraws,
  selectedGame: "mega645",
  powerSuggestionMode:"standard",
  settings: defaultSettings,
  gameSettings:{mega645:defaultSettings,power655:defaultSettings,lotto535:defaultLottoSettings},
  dashboardFilters: DEFAULT_FILTERS,
  gamePeriods:{mega645:DEFAULT_FILTERS.period,power655:DEFAULT_FILTERS.period,lotto535:DEFAULT_FILTERS.period},
  independentFilterConfig: DEFAULT_INDEPENDENT_FILTER,
  gameFilterConfigs:{mega645:DEFAULT_INDEPENDENT_FILTER,power655:DEFAULT_INDEPENDENT_FILTER,lotto535:DEFAULT_INDEPENDENT_FILTER},
  themeMode: "light",
  languageMode: "en",
  addDraw: draw => set(s => {const key=s.selectedGame==="mega645"?"draws":s.selectedGame==="power655"?"powerDraws":"lottoDraws";return {[key]:[...s[key],draw].sort((a,b)=>a.date.localeCompare(b.date))};}),
  updateDraw: (id, draw) => set(s => {const key=s.selectedGame==="mega645"?"draws":s.selectedGame==="power655"?"powerDraws":"lottoDraws";return {[key]:s[key].map(d=>d.id===id?draw:d).sort((a,b)=>a.date.localeCompare(b.date))};}),
  removeDraw: id => set(s => {const key=s.selectedGame==="mega645"?"draws":s.selectedGame==="power655"?"powerDraws":"lottoDraws";return {[key]:s[key].filter(d=>d.id!==id)};}),
  importData: data => set(s => {const {maxNumber,drawSize}=LOTTERY_GAMES[s.selectedGame];if(!validDraws(data.draws,s.selectedGame))throw new Error("Invalid draw history");const imported=mergeSettings(data.settings??s.settings,s.selectedGame==="lotto535"?defaultLottoSettings:defaultSettings);const settings=validSettings(imported,maxNumber,drawSize)?imported:s.settings;const gameSettings={...s.gameSettings,[s.selectedGame]:settings};const key=s.selectedGame==="mega645"?"draws":s.selectedGame==="power655"?"powerDraws":"lottoDraws";return {[key]:data.draws,settings,gameSettings};}),
  resetData: () => set({ draws: defaultDraws, powerDraws:defaultPowerDraws,lottoDraws:defaultLottoDraws }),
  resetSettings: () => set(s=>{const settings=s.selectedGame==="lotto535"?defaultLottoSettings:defaultSettings;return {settings,gameSettings:{...s.gameSettings,[s.selectedGame]:settings}};}),
  updateSettings: settings => set(s => {const next={...s.settings,...settings},config=LOTTERY_GAMES[s.selectedGame];return validSettings(next,config.maxNumber,config.drawSize)?{settings:next,gameSettings:{...s.gameSettings,[s.selectedGame]:next}}:{};}),
  updateDashboardFilters: filters => set(s => ({ dashboardFilters: { ...s.dashboardFilters, ...filters },gamePeriods:filters.period?{...s.gamePeriods,[s.selectedGame]:filters.period}:s.gamePeriods })),
  updateIndependentFilterConfig: config => set(s => {const independentFilterConfig=normalizeFilterConfig({...s.independentFilterConfig,...config});return {independentFilterConfig,gameFilterConfigs:{...s.gameFilterConfigs,[s.selectedGame]:independentFilterConfig}};}),
  setThemeMode: themeMode => set({ themeMode }),
  setLanguageMode: languageMode => set({ languageMode }),
  setSelectedGame: selectedGame => set(s=>({selectedGame,settings:s.gameSettings[selectedGame],independentFilterConfig:s.gameFilterConfigs[selectedGame],dashboardFilters:{...s.dashboardFilters,period:s.gamePeriods[selectedGame]}})),
  setPowerSuggestionMode: powerSuggestionMode => set(s=>({powerSuggestionMode,...(powerSuggestionMode==="experimental"&&s.selectedGame==="power655"?{dashboardFilters:{...s.dashboardFilters,period:"last50" as const},gamePeriods:{...s.gamePeriods,power655:"last50" as const}}:{})})),
}), {
  name: "mega645-analytics-data",
  version: 9,
  migrate: (persisted,version) => {
    const state=persisted as Partial<State>;
    const oldDemo=version<2&&state.draws?.length===53&&state.draws[0]?.id==="d01"&&state.draws.at(-1)?.id==="d53";
    const legacySettings=mergeSettings(state.settings);
    const legacyFilter=normalizeFilterConfig(state.independentFilterConfig);
    const period=normalizeDashboardFilters(state.dashboardFilters).period;
    return {...state,draws:oldDemo?defaultDraws:state.draws??defaultDraws,powerDraws:version<6?mergeBundledPowerDraws(state.powerDraws):state.powerDraws??defaultPowerDraws,lottoDraws:state.lottoDraws??defaultLottoDraws,selectedGame:state.selectedGame??"mega645",powerSuggestionMode:state.powerSuggestionMode??"standard",settings:legacySettings,gameSettings:{mega645:state.gameSettings?.mega645??legacySettings,power655:state.gameSettings?.power655??legacySettings,lotto535:mergeSettings(state.gameSettings?.lotto535??{},defaultLottoSettings)},gamePeriods:{mega645:state.gamePeriods?.mega645??period,power655:state.gamePeriods?.power655??period,lotto535:state.gamePeriods?.lotto535??period},languageMode:state.languageMode??"en",independentFilterConfig:legacyFilter,gameFilterConfigs:{mega645:state.gameFilterConfigs?.mega645??legacyFilter,power655:state.gameFilterConfigs?.power655??legacyFilter,lotto535:state.gameFilterConfigs?.lotto535??legacyFilter}};
  },
  merge: (persisted,current) => {
    const state=persisted as Partial<State>;
    const selectedGame=state.selectedGame??"mega645";
    const legacySettings=mergeSettings(state.settings);
    const legacyFilter=normalizeFilterConfig(state.independentFilterConfig);
    const gameSettings={mega645:mergeSettings(state.gameSettings?.mega645??legacySettings),power655:mergeSettings(state.gameSettings?.power655??legacySettings),lotto535:mergeSettings(state.gameSettings?.lotto535??{},defaultLottoSettings)};
    const gameFilterConfigs={mega645:normalizeFilterConfig(state.gameFilterConfigs?.mega645??legacyFilter),power655:normalizeFilterConfig(state.gameFilterConfigs?.power655??legacyFilter),lotto535:normalizeFilterConfig(state.gameFilterConfigs?.lotto535??legacyFilter)};
    const normalizedFilters=normalizeDashboardFilters(state.dashboardFilters);
    const gamePeriods={mega645:state.gamePeriods?.mega645??normalizedFilters.period,power655:state.gamePeriods?.power655??normalizedFilters.period,lotto535:state.gamePeriods?.lotto535??normalizedFilters.period};
    return {
      ...current,
      ...state,
      draws:mergeBundledDraws(state.draws,defaultDraws),
      powerDraws:mergeBundledPowerDraws(state.powerDraws),
      lottoDraws:mergeBundledDraws(state.lottoDraws,defaultLottoDraws),
      selectedGame,
      powerSuggestionMode:state.powerSuggestionMode==="experimental"?"experimental":"standard",
      settings:gameSettings[selectedGame],
      gameSettings,
      gamePeriods,
      dashboardFilters:{...normalizedFilters,period:gamePeriods[selectedGame]},
      independentFilterConfig:gameFilterConfigs[selectedGame],
      gameFilterConfigs,
    };
  },
}));
