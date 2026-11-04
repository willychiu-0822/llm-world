import { describe, expect, it } from "vitest";
import { bestMatch, textSimilarity } from "./text";

describe("textSimilarity", () => {
  it("is 1 for identical text and 0 for unrelated text", () => {
    expect(textSimilarity("試用課的流程", "試用課的流程")).toBe(1);
    expect(textSimilarity("聲樂", "跑步")).toBe(0);
  });
  it("scores partial overlap between 0 and 1, ignoring punctuation and case", () => {
    const s = textSimilarity("試用課要做什麼？", "試用課會做什麼");
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1);
    expect(textSimilarity("Open Mic!", "open mic")).toBe(1);
  });
  it("handles empty strings", () => {
    expect(textSimilarity("", "abc")).toBe(0);
  });
});

describe("bestMatch", () => {
  const faqs = [
    { id: "1", text: "跟不上怎麼辦？" },
    { id: "2", text: "要穿什麼衣服？" },
  ];
  it("returns the most similar item above the threshold", () => {
    expect(bestMatch("如果我跟不上怎麼辦", faqs)?.id).toBe("1");
  });
  it("returns undefined when nothing is similar enough", () => {
    expect(bestMatch("可以帶狗嗎", faqs)).toBeUndefined();
  });
});
