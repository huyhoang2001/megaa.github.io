import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { DEFAULT_FILTERS, DEFAULT_SETTINGS } from "./domain";
import type { Draw } from "./domain";
import { calculateTriples } from "./analytics";
import { settingsForPreset, useAnalytics } from "./hooks";
import { useLotteryStore } from "./store";

it("maps old scoring preset names to the new Gap presets",()=>{
  expect(settingsForPreset(DEFAULT_SETTINGS,"Legacy Gap")).toMatchObject({gapModelVersion:"legacy",consensusWeights:{frequency:10,momentum:10,gap:65,association:15}});
  expect(settingsForPreset(DEFAULT_SETTINGS,"Gap")).toEqual(settingsForPreset(DEFAULT_SETTINGS,"Legacy Gap"));
  expect(settingsForPreset(DEFAULT_SETTINGS,"Gap + Frequency")).toEqual(settingsForPreset(DEFAULT_SETTINGS,"Gap+Freq"));
  expect(settingsForPreset(DEFAULT_SETTINGS,"Gap+Freq")).toMatchObject({gapModelVersion:"v2",consensusWeights:{frequency:25,momentum:5,gap:65,association:5},comboWeightsV2:{single:32,pair:18,gap:35,structure:8,novelty:7}});
});

it("forces recent-draw cooldown off for Lotto even when stored settings enable it",()=>{
  const previous=useLotteryStore.getState();
  const draw:Draw={id:"lotto",date:"2026-10-10",numbers:[2,3,4,5,6],bonus:7,jackpot:1};
  const settings={...DEFAULT_SETTINGS,minTotal:35,recentDrawCooldown:{...DEFAULT_SETTINGS.recentDrawCooldown,enabled:true}};
  const container=document.createElement("div");
  document.body.append(container);
  const root=createRoot(container);
  let result:ReturnType<typeof useAnalytics>;
  function Probe(){result=useAnalytics();return null;}
  try{
    useLotteryStore.setState({selectedGame:"lotto535",lottoDraws:[draw],settings});
    act(()=>root.render(createElement(Probe)));
    expect(result!.cooldownNumbers.size).toBe(0);
  }finally{
    act(()=>root.unmount());
    container.remove();
    useLotteryStore.setState(previous);
  }
});

it("does not recalculate analytics for display-only selector changes",()=>{
  const previous=useLotteryStore.getState();
  const draws:Draw[]=Array.from({length:100},(_,index)=>({id:String(index),date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),numbers:Array.from({length:6},(_,offset)=>((index*6+offset)%45)+1),jackpot:1}));
  useLotteryStore.setState({draws,selectedGame:"mega645",settings:DEFAULT_SETTINGS,dashboardFilters:{...DEFAULT_FILTERS,period:"all",predictionCount:5}});
  const container=document.createElement("div");
  document.body.append(container);
  const root=createRoot(container);
  let result:ReturnType<typeof useAnalytics>;
    function Probe({count,skip}:{count?:number;skip?:boolean}){result=useAnalytics(count,skip);return null;}
  try {
    act(()=>root.render(createElement(Probe,{})));
    const initial=result!;
    expect(initial.predictions).toHaveLength(5);
    act(()=>useLotteryStore.getState().updateDashboardFilters({analysisView:"Pairs",predictionCount:20}));
    expect(result!.filtered).toBe(initial.filtered);
    expect(result!.predictions).not.toBe(initial.predictions);
    expect(result!.predictions).toHaveLength(20);
    act(()=>root.render(createElement(Probe,{count:50})));
    expect(result!.singles).toBe(initial.singles);
    expect(result!.predictions).not.toBe(initial.predictions);
    const beforePeriodChange=result!;
    act(()=>useLotteryStore.getState().updateDashboardFilters({period:"last10"}));
    expect(result!.filtered).toHaveLength(10);
    const lastTen=draws.slice(-10);
    expect(result!.singles.find(item=>item.number===1)?.totalCount).toBe(lastTen.filter(draw=>draw.numbers.includes(1)).length);
    expect(result!.pairs.find(item=>item.key==="01-02")?.count).toBe(lastTen.filter(draw=>draw.numbers.includes(1)&&draw.numbers.includes(2)).length);
    expect(calculateTriples(result!.filtered).find(item=>item.key==="01-02-03")?.count).toBe(lastTen.filter(draw=>[1,2,3].every(number=>draw.numbers.includes(number))).length);
    expect(result!.predictions).not.toBe(beforePeriodChange.predictions);
    const megaPredictions=result!.predictions.map(item=>item.numbers.join("-"));
    act(()=>useLotteryStore.getState().setPowerSuggestionMode("experimental"));
    expect(result!.predictions.map(item=>item.numbers.join("-"))).toEqual(megaPredictions);
    const beforeFilter=result!.predictions;
    act(()=>useLotteryStore.getState().updateIndependentFilterConfig({preset:"Hot"}));
    expect(result!.predictions).toBe(beforeFilter);
    const periodSingles=result!.singles;
    act(()=>root.render(createElement(Probe,{skip:true})));
    expect(result!.singles).toBe(periodSingles);
    expect(result!.predictions).toEqual([]);
  } finally {
    act(()=>root.unmount());
    container.remove();
    useLotteryStore.setState(previous);
  }
});
