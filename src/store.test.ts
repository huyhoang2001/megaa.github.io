import { describe,expect,it } from "vitest";
import powerHistory from "./data/power655-history.json";
import lottoHistory from "./data/lotto535-history.json";
import type { AnalysisSettings, Draw } from "./domain";
import { mergeBundledDraws, mergeBundledPowerDraws, mergeSettings, normalizeDashboardFilters, useLotteryStore, validDraws, validSettings } from "./store";

describe("Power history persistence migration",()=>{
  it("uses only the five selectable periods for saved filters",()=>{
    expect(normalizeDashboardFilters({period:"last10"}).period).toBe("last1year");
    expect(normalizeDashboardFilters({period:"last50"}).period).toBe("last50");
    expect(normalizeDashboardFilters({scoringPreset:"Legacy Gap"}).scoringPreset).toBe("Gap");
    expect(normalizeDashboardFilters({scoringPreset:"Gap + Frequency"}).scoringPreset).toBe("Gap+Freq");
  });
  it("upgrades the previous default digital roots",()=>{
    expect(mergeSettings({allowedDigitalRoots:[1,3,5,8]}).allowedDigitalRoots).toEqual([1,3,5,6,7,8,9]);
  });
  it("keeps suggested parity limited to balanced 3/3, 4/2, or 2/4",()=>{
    expect(mergeSettings({allowedParity:["6/0","5/1","1/5","0/6"]}).allowedParity).toEqual(["3/3","4/2","2/4"]);
    expect(mergeSettings({allowedParity:["2/4","4/2"]}).allowedParity).toEqual(["2/4","4/2"]);
  });
  it("merges and validates recent-draw cooldown preferences",()=>{
    expect(mergeSettings().recentDrawCooldown).toEqual({enabled:true,draws:1,mode:"hard",includeBonus:false,softPenalty:25});
    expect(mergeSettings({recentDrawCooldown:{...mergeSettings().recentDrawCooldown,mode:"soft",includeBonus:true}}).recentDrawCooldown).toMatchObject({mode:"soft",includeBonus:true});
    const preferences={enabled:false,draws:4,mode:"soft" as const,includeBonus:true,softPenalty:40};
    expect(mergeSettings({recentDrawCooldown:preferences}).recentDrawCooldown).toEqual(preferences);
    expect(mergeSettings({recentDrawCooldown:{mode:"soft",draws:3}} as Partial<AnalysisSettings>).recentDrawCooldown.enabled).toBe(true);
    expect(validSettings({...mergeSettings(),recentDrawCooldown:{...mergeSettings().recentDrawCooldown,draws:0}})).toBe(false);
    expect(validSettings({...mergeSettings(),recentDrawCooldown:{...mergeSettings().recentDrawCooldown,softPenalty:51}})).toBe(false);
  });
  it("restores official jackpot values and missing draws while preserving edits",()=>{
    const latest=powerHistory.draws.at(-1) as Draw;
    const stored:Draw[]=[
      {...latest,numbers:[1,2,3,4,5,6],jackpot:0,jackpot2:undefined},
      {id:"custom",date:"2026-10-04",numbers:[1,2,3,4,5,7],bonus:8,jackpot:123},
    ];
    const merged=mergeBundledPowerDraws(stored);
    const restored=merged.find(draw=>draw.id===latest.id);
    expect(restored?.numbers).toEqual([1,2,3,4,5,6]);
    expect(restored?.jackpot).toBe(latest.jackpot);
    expect(restored?.jackpot2).toBe(latest.jackpot2);
    expect(merged).toHaveLength(powerHistory.draws.length+1);
    expect(merged.some(draw=>draw.id==="custom")).toBe(true);
  });
  it("adds newly bundled draws during hydration",()=>{
    const bundled:Draw[]=[
      {id:"1",date:"2026-01-01",numbers:[1,2,3,4,5,6],jackpot:10},
      {id:"2",date:"2026-01-02",numbers:[7,8,9,10,11,12],jackpot:20},
    ];
    const merged=mergeBundledDraws([{...bundled[0],numbers:[2,3,4,5,6,7]}],bundled);
    expect(merged).toHaveLength(2);
    expect(merged[0].numbers).toEqual([2,3,4,5,6,7]);
    expect(merged[1]).toEqual(bundled[1]);
  });
  it("rejects invalid imported draws and settings before persisting",()=>{
    const draw:Draw={id:"a",date:"2026-10-07",numbers:[1,2,3,4,5,6],jackpot:0};
    expect(validDraws([draw],45)).toBe(true);
    expect(validDraws([draw,{...draw}],45)).toBe(false);
    expect(validDraws([{...draw,numbers:[1,2,3,4,5,53]}],45)).toBe(false);
    expect(validDraws([{...draw,date:"2026-02-30"}],45)).toBe(false);
    expect(validSettings({...mergeSettings(),candidatePoolSize:NaN})).toBe(false);
    expect(validSettings({...mergeSettings(),consensusWeights:{frequency:0,momentum:0,gap:0,association:0}})).toBe(false);
    expect(validSettings({...mergeSettings(),minTotal:256},45)).toBe(false);
    expect(validSettings({...mergeSettings(),minTotal:315},55)).toBe(true);
  });
  it("accepts positive safe-integer candidate pool sizes without a fixed upper cap",()=>{
    const settings=mergeSettings();
    expect(settings.candidatePoolSize).toBe(14);
    for(const candidatePoolSize of [1,19,1000,Number.MAX_SAFE_INTEGER])expect(validSettings({...settings,candidatePoolSize})).toBe(true);
    for(const candidatePoolSize of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,Infinity])expect(validSettings({...settings,candidatePoolSize})).toBe(false);
  });
  it("accepts five main numbers and the 1–12 special number for Lotto 5/35",()=>{
    const draws=lottoHistory.draws as Draw[];
    expect(validDraws(draws,"lotto535")).toBe(true);
    expect(validDraws([{...draws.at(-1)!,numbers:[1,2,3,4,5,6]}],"lotto535")).toBe(false);
    expect(validSettings({...mergeSettings(),minTotal:35},35,5)).toBe(true);
  });
  it("keeps settings and filter presets separate when switching games",()=>{
    const original=useLotteryStore.getState();
    try{
      useLotteryStore.getState().setSelectedGame("mega645");
      useLotteryStore.getState().updateSettings({minTotal:120});
      useLotteryStore.getState().updateIndependentFilterConfig({preset:"Legacy Gap"});
      useLotteryStore.getState().setSelectedGame("power655");
      useLotteryStore.getState().updateSettings({minTotal:300});
      useLotteryStore.getState().updateIndependentFilterConfig({preset:"Hot"});
      useLotteryStore.getState().setSelectedGame("mega645");
      expect(useLotteryStore.getState().settings.minTotal).toBe(120);
      expect(useLotteryStore.getState().independentFilterConfig.preset).toBe("Gap");
      useLotteryStore.getState().resetSettings();
      useLotteryStore.getState().setSelectedGame("power655");
      expect(useLotteryStore.getState().settings.minTotal).toBe(300);
      expect(useLotteryStore.getState().independentFilterConfig.preset).toBe("Hot");
    }finally{useLotteryStore.setState(original);}
  });
  it("keeps Mega's period when enabling experimental Power",()=>{
    const original=useLotteryStore.getState();
    try{
      useLotteryStore.getState().setSelectedGame("mega645");
      useLotteryStore.getState().updateDashboardFilters({period:"last100"});
      useLotteryStore.getState().setSelectedGame("power655");
      useLotteryStore.getState().setPowerSuggestionMode("experimental");
      expect(useLotteryStore.getState().dashboardFilters.period).toBe("last50");
      useLotteryStore.getState().setSelectedGame("mega645");
      expect(useLotteryStore.getState().dashboardFilters.period).toBe("last100");
    }finally{useLotteryStore.setState(original);}
  });
});
