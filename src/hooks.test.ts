import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { DEFAULT_FILTERS, DEFAULT_SETTINGS } from "./domain";
import type { Draw } from "./domain";
import { useAnalytics } from "./hooks";
import { useLotteryStore } from "./store";

it("does not recalculate analytics for display-only selector changes",()=>{
  const previous=useLotteryStore.getState();
  const draws:Draw[]=[{id:"one",date:"2026-01-01",numbers:[1,2,3,4,5,6],jackpot:1}];
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
    act(()=>root.render(createElement(Probe,{skip:true})));
    expect(result!.singles).toBe(initial.singles);
    expect(result!.predictions).toEqual([]);
  } finally {
    act(()=>root.unmount());
    container.remove();
    useLotteryStore.setState(previous);
  }
});
