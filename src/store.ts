import { create } from "zustand";
import { persist } from "zustand/middleware";
import history from "./data/mega645-history.json";
import powerHistory from "./data/power655-history.json";
import settingsJson from "./data/default-settings.json";
import type { AnalysisSettings, DashboardFilters, Draw, IndependentFilterConfig, LanguageMode, LotteryGame, ThemeMode } from "./domain";
import { DEFAULT_FILTERS, DEFAULT_INDEPENDENT_FILTER } from "./domain";

type State = {
  draws: Draw[];
  powerDraws: Draw[];
  selectedGame: LotteryGame;
  settings: AnalysisSettings;
  gameSettings:Record<LotteryGame,AnalysisSettings>;
  dashboardFilters: DashboardFilters;
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
};

const defaultDraws = history.draws as Draw[];
const defaultPowerDraws = powerHistory.draws as Draw[];
const defaultSettings = settingsJson as AnalysisSettings;
const previousDefaultRoots=[[8,5,3,1],[1,2,3,4,5,6,7,8,9]];
const selectablePeriods=new Set<DashboardFilters["period"]>(["last30","last50","last100","last1year","all"]);
export const normalizeDashboardFilters=(filters?:Partial<DashboardFilters>):DashboardFilters=>{
  const merged={...DEFAULT_FILTERS,...filters};
  return {...merged,period:selectablePeriods.has(merged.period)?merged.period:DEFAULT_FILTERS.period,scoringPreset:merged.scoringPreset==="Gap"?"Legacy Gap":merged.scoringPreset};
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
export const mergeSettings=(settings?:Partial<AnalysisSettings>):AnalysisSettings=>({
  ...defaultSettings,...settings,
  singleWeights:{...defaultSettings.singleWeights,...settings?.singleWeights},
  combinationWeights:{...defaultSettings.combinationWeights,...settings?.combinationWeights},
  allowedParity:settings?.allowedParity?.filter(value=>defaultSettings.allowedParity.includes(value)).length?settings.allowedParity.filter(value=>defaultSettings.allowedParity.includes(value)):[...defaultSettings.allowedParity],
  allowedDigitalRoots:settings?.allowedDigitalRoots&&previousDefaultRoots.some(roots=>settings.allowedDigitalRoots!.length===roots.length&&roots.every(root=>settings.allowedDigitalRoots!.includes(root)))?defaultSettings.allowedDigitalRoots:[...(settings?.allowedDigitalRoots??defaultSettings.allowedDigitalRoots)],
  consensusWeights:{...defaultSettings.consensusWeights,...settings?.consensusWeights},
  comboWeightsV2:{...defaultSettings.comboWeightsV2,...settings?.comboWeightsV2},
});
export const validSettings=(settings:AnalysisSettings,maxNumber=55)=>{
  const integer=(value:number,min:number,max:number)=>Number.isInteger(value)&&value>=min&&value<=max;
  const weights=(values:Record<string,number>)=>Object.values(values).every(value=>Number.isFinite(value)&&value>=0)&&Object.values(values).some(value=>value>0);
  return integer(settings.candidatePoolSize,6,Math.min(18,maxNumber))&&integer(settings.minTotal,0,6*maxNumber-15)&&integer(settings.maxCombinationOverlap,0,5)&&Number.isFinite(settings.weightedFrequencyHalfLife)&&settings.weightedFrequencyHalfLife>0&&integer(settings.minPairSupport,1,10000)&&integer(settings.minCompletedGaps??4,1,10000)&&weights(settings.consensusWeights)&&weights(settings.comboWeightsV2);
};
const normalizeFilterConfig=(config?:Partial<IndependentFilterConfig>):IndependentFilterConfig=>({...DEFAULT_INDEPENDENT_FILTER,...config,preset:config?.preset==="Gap"?"Legacy Gap":config?.preset??DEFAULT_INDEPENDENT_FILTER.preset});
export const validDraws=(draws:Draw[],maxNumber:number)=>{
  const ids=new Set<string>();
  return draws.length>0&&draws.every(draw=>{
    if(!draw.id||ids.has(draw.id)||!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)||!Number.isFinite(Date.parse(`${draw.date}T00:00:00Z`))||new Date(`${draw.date}T00:00:00Z`).toISOString().slice(0,10)!==draw.date)return false;
    ids.add(draw.id);
    return draw.numbers.length===6&&new Set(draw.numbers).size===6&&draw.numbers.every(number=>Number.isInteger(number)&&number>=1&&number<=maxNumber)&&Number.isFinite(draw.jackpot)&&draw.jackpot>=0&&(maxNumber!==55||(Number.isInteger(draw.bonus)&&draw.bonus!>=1&&draw.bonus!<=55&&!draw.numbers.includes(draw.bonus!)));
  });
};

export const useLotteryStore = create<State>()(persist((set) => ({
  draws: defaultDraws,
  powerDraws: defaultPowerDraws,
  selectedGame: "mega645",
  settings: defaultSettings,
  gameSettings:{mega645:defaultSettings,power655:defaultSettings},
  dashboardFilters: DEFAULT_FILTERS,
  independentFilterConfig: DEFAULT_INDEPENDENT_FILTER,
  gameFilterConfigs:{mega645:DEFAULT_INDEPENDENT_FILTER,power655:DEFAULT_INDEPENDENT_FILTER},
  themeMode: "light",
  languageMode: "en",
  addDraw: draw => set(s => s.selectedGame==="power655"?{powerDraws:[...s.powerDraws,draw].sort((a,b)=>a.date.localeCompare(b.date))}:{draws:[...s.draws,draw].sort((a,b)=>a.date.localeCompare(b.date))}),
  updateDraw: (id, draw) => set(s => s.selectedGame==="power655"?{powerDraws:s.powerDraws.map(d=>d.id===id?draw:d).sort((a,b)=>a.date.localeCompare(b.date))}:{draws:s.draws.map(d=>d.id===id?draw:d).sort((a,b)=>a.date.localeCompare(b.date))}),
  removeDraw: id => set(s => s.selectedGame==="power655"?{powerDraws:s.powerDraws.filter(d=>d.id!==id)}:{draws:s.draws.filter(d=>d.id!==id)}),
  importData: data => set(s => {const maxNumber=s.selectedGame==="power655"?55:45;if(!validDraws(data.draws,maxNumber))throw new Error("Invalid draw history");const imported=mergeSettings(data.settings??s.settings);const settings=validSettings(imported,maxNumber)?imported:s.settings;const gameSettings={...s.gameSettings,[s.selectedGame]:settings};return s.selectedGame==="power655"?{powerDraws:data.draws,settings,gameSettings}:{draws:data.draws,settings,gameSettings};}),
  resetData: () => set({ draws: defaultDraws, powerDraws:defaultPowerDraws }),
  resetSettings: () => set(s=>({settings:defaultSettings,gameSettings:{...s.gameSettings,[s.selectedGame]:defaultSettings}})),
  updateSettings: settings => set(s => {const next={...s.settings,...settings};return validSettings(next,s.selectedGame==="power655"?55:45)?{settings:next,gameSettings:{...s.gameSettings,[s.selectedGame]:next}}:{};}),
  updateDashboardFilters: filters => set(s => ({ dashboardFilters: { ...s.dashboardFilters, ...filters } })),
  updateIndependentFilterConfig: config => set(s => {const independentFilterConfig={...s.independentFilterConfig,...config};return {independentFilterConfig,gameFilterConfigs:{...s.gameFilterConfigs,[s.selectedGame]:independentFilterConfig}};}),
  setThemeMode: themeMode => set({ themeMode }),
  setLanguageMode: languageMode => set({ languageMode }),
  setSelectedGame: selectedGame => set(s=>({selectedGame,settings:s.gameSettings[selectedGame],independentFilterConfig:s.gameFilterConfigs[selectedGame]})),
}), {
  name: "mega645-analytics-data",
  version: 7,
  migrate: (persisted,version) => {
    const state=persisted as Partial<State>;
    const oldDemo=version<2&&state.draws?.length===53&&state.draws[0]?.id==="d01"&&state.draws.at(-1)?.id==="d53";
    const legacySettings=mergeSettings(state.settings);
    const legacyFilter=normalizeFilterConfig(state.independentFilterConfig);
    return {...state,draws:oldDemo?defaultDraws:state.draws??defaultDraws,powerDraws:version<6?mergeBundledPowerDraws(state.powerDraws):state.powerDraws??defaultPowerDraws,selectedGame:state.selectedGame??"mega645",settings:legacySettings,gameSettings:state.gameSettings??{mega645:legacySettings,power655:legacySettings},languageMode:state.languageMode??"en",independentFilterConfig:legacyFilter,gameFilterConfigs:state.gameFilterConfigs??{mega645:legacyFilter,power655:legacyFilter}};
  },
  merge: (persisted,current) => {
    const state=persisted as Partial<State>;
    const selectedGame=state.selectedGame??"mega645";
    const legacySettings=mergeSettings(state.settings);
    const legacyFilter=normalizeFilterConfig(state.independentFilterConfig);
    const gameSettings={mega645:mergeSettings(state.gameSettings?.mega645??legacySettings),power655:mergeSettings(state.gameSettings?.power655??legacySettings)};
    const gameFilterConfigs={mega645:normalizeFilterConfig(state.gameFilterConfigs?.mega645??legacyFilter),power655:normalizeFilterConfig(state.gameFilterConfigs?.power655??legacyFilter)};
    return {
      ...current,
      ...state,
      draws:mergeBundledDraws(state.draws,defaultDraws),
      powerDraws:mergeBundledPowerDraws(state.powerDraws),
      selectedGame,
      settings:gameSettings[selectedGame],
      gameSettings,
      dashboardFilters:normalizeDashboardFilters(state.dashboardFilters),
      independentFilterConfig:gameFilterConfigs[selectedGame],
      gameFilterConfigs,
    };
  },
}));
