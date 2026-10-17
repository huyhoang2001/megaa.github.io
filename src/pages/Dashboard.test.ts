import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ChartCard, jackpotHistoryData, MiniPieInfo } from "./Dashboard";
import type { Draw } from "../domain";

let container:HTMLDivElement|undefined;
afterEach(()=>container?.remove());

describe("MiniPieInfo",()=>{
  it("closes outside and can be opened again",()=>{
    container=document.createElement("div");
    document.body.append(container);
    const root=createRoot(container);
    act(()=>root.render(createElement(MiniPieInfo,{title:"Inside/Outside",info:"Inside numbers: 02, 03"})));
    const button=container.querySelector("button")!;
    act(()=>button.click());
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    act(()=>document.body.dispatchEvent(new Event("pointerdown",{bubbles:true})));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    act(()=>button.click());
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain("02, 03");
    act(()=>root.unmount());
  });
});

describe("ChartCard",()=>{
  it("renders navigator content only in the enlarged view",()=>{
    container=document.createElement("div");
    document.body.append(container);
    const root=createRoot(container);
    act(()=>root.render(createElement(ChartCard,{title:"Test chart",children:(expanded:boolean)=>createElement("span",null,expanded?"Navigator":"Compact chart")})));
    expect(container.textContent).toContain("Compact chart");
    expect(container.textContent).not.toContain("Navigator");
    act(()=>container!.querySelector<HTMLButtonElement>(".chart-action")!.click());
    expect(document.querySelector(".chart-modal-body")?.textContent).toContain("Navigator");
    act(()=>root.unmount());
  });
});

describe("jackpotHistoryData",()=>{
  it("keeps all recorded prize values and skips unavailable ones",()=>{
    const draws=[
      {id:"1",date:"2020-01-01",numbers:[1,2,3,4,5,6],jackpot:10_000_000_000,jackpot2:0},
      {id:"2",date:"2020-01-04",numbers:[1,2,3,4,5,6],jackpot:12_000_000_000,jackpot2:3_000_000_000},
    ] as Draw[];
    expect(jackpotHistoryData(draws,"jackpot").map(draw=>draw.id)).toEqual(["1","2"]);
    expect(jackpotHistoryData(draws,"jackpot2").map(draw=>draw.id)).toEqual(["2"]);
  });
});
