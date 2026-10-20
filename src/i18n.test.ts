import { describe, expect, it } from "vitest";
import translations from "./data/languages.json";

describe("translations", () => {
  it("keeps Vietnamese and English translation keys in sync", () => {
    expect(Object.keys(translations.vi).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it("provides visible labels for both languages", () => {
    expect(translations.en["nav.dashboard"]).toBe("Dashboard");
    expect(translations.vi["nav.dashboard"]).toBe("Tổng quan");
  });

  it("localizes the cooldown switch and its explanation",()=>{
    expect(translations.en["settings.cooldownToggle"]).toBe("Apply recent draw cooldown");
    expect(translations.vi["settings.cooldownToggle"]).toBe("Bật cooldown kỳ quay gần đây");
    expect(translations.en["settings.cooldownHelp"]).toContain("OFF disables cooldown filtering and penalties");
    expect(translations.vi["settings.cooldownHelp"]).toContain("TẮT sẽ vô hiệu hóa lọc và trừ điểm cooldown");
  });
});
