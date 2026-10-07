import { describe, expect, it } from "vitest";
import { matchesColumnFilter } from "./tableUtils";

describe("Excel-style column filters",()=>{
  it("matches text without case sensitivity",()=>{
    expect(matchesColumnFilter("DROUGHT","drou")).toBe(true);
    expect(matchesColumnFilter("HOT","cool")).toBe(false);
  });
  it("supports exact numbers, comparisons, and inclusive ranges",()=>{
    expect(matchesColumnFilter(18,"18")).toBe(true);
    expect(matchesColumnFilter(18,">10")).toBe(true);
    expect(matchesColumnFilter(18,"<=17")).toBe(false);
    expect(matchesColumnFilter(18,"10..18")).toBe(true);
    expect(matchesColumnFilter(18,"19..30")).toBe(false);
  });
});
