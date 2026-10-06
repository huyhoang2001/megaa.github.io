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
});
