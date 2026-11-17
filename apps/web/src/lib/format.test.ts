import { describe, expect, it } from "vitest";
import { formatLifeDay } from "./format";

describe("formatLifeDay", () => {
  it("把日子寫成「11 月 14 日，秋天的早晨」", () => {
    expect(formatLifeDay("2026-11-14", { season: "秋", period: "早晨" })).toBe("11 月 14 日，秋天的早晨");
  });

  it("只有日期時依月份補季節，不隨便猜時段", () => {
    expect(formatLifeDay("2026-11-14")).toBe("11 月 14 日，秋天");
    expect(formatLifeDay("2026-01-03")).toBe("1 月 3 日，冬天");
    expect(formatLifeDay("2026-04-01")).toBe("4 月 1 日，春天");
    expect(formatLifeDay("2026-08-20")).toBe("8 月 20 日，夏天");
  });

  it("季節已經帶「天」時不會寫成秋天天", () => {
    expect(formatLifeDay("2026-11-14", { season: "秋天", period: "傍晚" })).toBe("11 月 14 日，秋天的傍晚");
  });

  it("不是 YYYY-MM-DD 的字串原樣留下", () => {
    expect(formatLifeDay("昨天")).toBe("昨天");
  });
});
