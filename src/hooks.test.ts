import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { DEFAULT_FILTERS, DEFAULT_SETTINGS } from "./domain";
import type { Draw } from "./domain";
import { settingsForPreset, useAnalytics } from "./hooks";
import { useLotteryStore } from "./store";

it("preserves the former Gap preset as Legacy Gap",()=>{
  expect(settingsForPreset(DEFAULT_SETTINGS,"Legacy Gap")).toMatchObject({gapModelVersion:"legacy",consensusWeights:{frequency:10,momentum:10,gap:65,association:15}});
  expect(settingsForPreset(DEFAULT_SETTINGS,"Gap")).toEqual(settingsForPreset(DEFAULT_SETTINGS,"Legacy Gap"));
});

it("does not recalculate analytics for display-only selector changes",()=>{
  const previous=useLotteryStore.getState();
  const draws:Draw[]=Array.from({length:12},(_,index)=>({id:String(index),date:`2026-01-${String(index+1).padStart(2,"0")}`,numbers:[1,2,3,4,5,7+index] as Draw["numbers"],jackpot:1}));
  useLotteryStore.setState({draws,selectedGame:"mega645",settings:DEFAULT_SETTINGS,dashboardFilters:{...DEFAULT_FILTERS,period:"all"}});
  const container=document.createElement("div");
  document.body.append(container);
  const root=createRoot(container);
  let result:ReturnType<typeof useAnalytics>;
  function Probe({count,skip}:{count?:number;skip?:boolean}){result=useAnalytics(count,skip);return null;}
  try {
    act(()=>root.render(createElement(Probe,{count:20})));
    const initial=result!;
    act(()=>useLotteryStore.getState().updateDashboardFilters({analysisView:"Pairs",predictionCount:20}));
    expect(result!.filtered).toBe(initial.filtered);
    expect(result!.predictions).toBe(initial.predictions);
    act(()=>root.render(createElement(Probe,{count:50})));
    expect(result!.singles).toBe(initial.singles);
    expect(result!.predictions).not.toBe(initial.predictions);
    const beforePeriodChange=result!;
    act(()=>useLotteryStore.getState().updateDashboardFilters({period:"last10"}));
    expect(result!.filtered).toHaveLength(10);
    expect(result!.singles.find(item=>item.number===1)?.totalCount).toBe(10);
    expect(result!.pairs.find(item=>item.key==="01-02")?.count).toBe(10);
    expect(result!.triples.find(item=>item.key==="01-02-03")?.count).toBe(10);
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
