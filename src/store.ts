import { create } from "zustand";
import { persist } from "zustand/middleware";
import history from "./data/mega645-history.json";
import powerHistory from "./data/power655-history.json";
import settingsJson from "./data/default-settings.json";
import type { AnalysisSettings, DashboardFilters, Draw, LanguageMode, LotteryGame, ThemeMode } from "./domain";
import { DEFAULT_FILTERS } from "./domain";

type State = {
  draws: Draw[];
  powerDraws: Draw[];
  selectedGame: LotteryGame;
  settings: AnalysisSettings;
  dashboardFilters: DashboardFilters;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  addDraw: (draw: Draw) => void;
  updateDraw: (id: string, draw: Draw) => void;
  removeDraw: (id: string) => void;
  importData: (data: { draws: Draw[]; settings?: AnalysisSettings }) => void;
  resetData: () => void;
  updateSettings: (settings: Partial<AnalysisSettings>) => void;
  updateDashboardFilters: (filters: Partial<DashboardFilters>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguageMode: (mode: LanguageMode) => void;
  setSelectedGame: (game: LotteryGame) => void;
};

const defaultDraws = history.draws as Draw[];
const defaultPowerDraws = powerHistory.draws as Draw[];
const defaultSettings = settingsJson as AnalysisSettings;
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
const mergeSettings=(settings?:Partial<AnalysisSettings>):AnalysisSettings=>({
  ...defaultSettings,...settings,
  singleWeights:{...defaultSettings.singleWeights,...settings?.singleWeights},
  combinationWeights:{...defaultSettings.combinationWeights,...settings?.combinationWeights},
  consensusWeights:{...defaultSettings.consensusWeights,...settings?.consensusWeights},
  comboWeightsV2:{...defaultSettings.comboWeightsV2,...settings?.comboWeightsV2},
});

export const useLotteryStore = create<State>()(persist((set) => ({
  draws: defaultDraws,
  powerDraws: defaultPowerDraws,
  selectedGame: "mega645",
  settings: defaultSettings,
  dashboardFilters: DEFAULT_FILTERS,
  themeMode: "light",
  languageMode: "en",
  addDraw: draw => set(s => s.selectedGame==="power655"?{powerDraws:[...s.powerDraws,draw].sort((a,b)=>a.date.localeCompare(b.date))}:{draws:[...s.draws,draw].sort((a,b)=>a.date.localeCompare(b.date))}),
  updateDraw: (id, draw) => set(s => s.selectedGame==="power655"?{powerDraws:s.powerDraws.map(d=>d.id===id?draw:d).sort((a,b)=>a.date.localeCompare(b.date))}:{draws:s.draws.map(d=>d.id===id?draw:d).sort((a,b)=>a.date.localeCompare(b.date))}),
  removeDraw: id => set(s => s.selectedGame==="power655"?{powerDraws:s.powerDraws.filter(d=>d.id!==id)}:{draws:s.draws.filter(d=>d.id!==id)}),
  importData: data => set(s => s.selectedGame==="power655"?{powerDraws:data.draws,settings:mergeSettings(data.settings??s.settings)}:{draws:data.draws,settings:mergeSettings(data.settings??s.settings)}),
  resetData: () => set({ draws: defaultDraws, powerDraws:defaultPowerDraws, settings: defaultSettings, dashboardFilters: DEFAULT_FILTERS }),
  updateSettings: settings => set(s => ({ settings: { ...s.settings, ...settings } })),
  updateDashboardFilters: filters => set(s => ({ dashboardFilters: { ...s.dashboardFilters, ...filters } })),
  setThemeMode: themeMode => set({ themeMode }),
  setLanguageMode: languageMode => set({ languageMode }),
  setSelectedGame: selectedGame => set({selectedGame}),
}), {
  name: "mega645-analytics-data",
  version: 6,
  migrate: (persisted,version) => {
    const state=persisted as Partial<State>;
    const oldDemo=version<2&&state.draws?.length===53&&state.draws[0]?.id==="d01"&&state.draws.at(-1)?.id==="d53";
    return {...state,draws:oldDemo?defaultDraws:state.draws??defaultDraws,powerDraws:version<6?mergeBundledPowerDraws(state.powerDraws):state.powerDraws??defaultPowerDraws,selectedGame:state.selectedGame??"mega645",settings:mergeSettings(state.settings),languageMode:state.languageMode??"en"};
  },
  merge: (persisted,current) => {
    const state=persisted as Partial<State>;
    return {
      ...current,
      ...state,
      draws:mergeBundledDraws(state.draws,defaultDraws),
      powerDraws:mergeBundledPowerDraws(state.powerDraws),
      settings:mergeSettings(state.settings),
    };
  },
}));
