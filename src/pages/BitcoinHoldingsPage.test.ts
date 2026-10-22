import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { referenceTreasuries } from "../bitcoinTreasuriesData";
import BitcoinHoldingsPage, { layoutTreasuryLabels } from "./BitcoinHoldingsPage";

let container:HTMLDivElement|undefined;
afterEach(()=>container?.remove());

describe("Bitcoin holdings reference chart",()=>{
  it("keeps the supplied percentages complete and labels separated",()=>{
    expect(referenceTreasuries.reduce((sum,entry)=>sum+entry.percentage,0)).toBeCloseTo(100,10);
    expect(new Set(referenceTreasuries.map(entry=>entry.id)).size).toBe(referenceTreasuries.length);
    const labels=layoutTreasuryLabels(referenceTreasuries);
    for(const side of ["left","right"] as const){
      const y=labels.filter(label=>label.side===side).map(label=>label.labelY).sort((a,b)=>a-b);
      expect(y.every((value,index)=>index===0||value-y[index-1]>=34.9)).toBe(true);
    }
  });

  it("selects a slice and clears it with Escape",()=>{
    container=document.createElement("div");
    document.body.append(container);
    const root=createRoot(container);
    act(()=>root.render(createElement(BitcoinHoldingsPage)));
    const strategy=container.querySelector<SVGPathElement>('[aria-label="Strategy, 61.99 percent"]')!;
    act(()=>strategy.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect(strategy.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".btc-holdings-center")?.textContent).toContain("Strategy");
    act(()=>container!.querySelector("svg")!.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
    expect(strategy.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".btc-holdings-center")?.textContent).toContain("Total BTC Held:");
    act(()=>root.unmount());
  });
});
