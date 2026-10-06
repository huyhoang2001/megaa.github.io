import { describe,expect,it } from "vitest";
import powerHistory from "./data/power655-history.json";
import type { Draw } from "./domain";
import { mergeBundledDraws, mergeBundledPowerDraws } from "./store";

describe("Power history persistence migration",()=>{
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
});
