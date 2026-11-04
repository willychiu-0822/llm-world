import { describe, expect, it } from "vitest";
import { createModerator, keywordProvider } from "./moderation";

const words = keywordProvider({ words: ["壞字", "badword"], category: "profanity" });

describe("moderation pipeline", () => {
  it("allows clean text in every mode", async () => {
    for (const mode of ["off", "log", "filter", "block"] as const) {
      const m = createModerator({ mode, providers: [words] });
      const r = await m.check("今天去上了聲樂課");
      expect(r.action).toBe("allow");
      expect(r.text).toBe("今天去上了聲樂課");
      expect(r.flagged).toBe(false);
    }
  });

  it("off mode never checks", async () => {
    const m = createModerator({ mode: "off", providers: [words] });
    const r = await m.check("這是壞字");
    expect(r).toMatchObject({ action: "allow", flagged: false, text: "這是壞字" });
  });

  it("log mode keeps text but reports the flag", async () => {
    const m = createModerator({ mode: "log", providers: [words] });
    const r = await m.check("這是壞字");
    expect(r).toMatchObject({ action: "allow", flagged: true, text: "這是壞字", categories: ["profanity"] });
  });

  it("filter mode masks flagged spans, case-insensitively", async () => {
    const m = createModerator({ mode: "filter", providers: [words] });
    const r = await m.check("這是壞字 and BadWord!");
    expect(r.action).toBe("filter");
    expect(r.text).toBe("這是** and *******!");
    expect(r.flagged).toBe(true);
  });

  it("block mode rejects flagged text", async () => {
    const m = createModerator({ mode: "block", providers: [words] });
    const r = await m.check("這是壞字");
    expect(r.action).toBe("block");
    expect(r.flagged).toBe(true);
  });

  it("merges results from several providers", async () => {
    const custom = { name: "custom", check: async (t: string) => (t.includes("x") ? { flagged: true, categories: ["custom"], spans: [{ start: t.indexOf("x"), end: t.indexOf("x") + 1 }] } : { flagged: false, categories: [], spans: [] }) };
    const m = createModerator({ mode: "filter", providers: [words, custom] });
    const r = await m.check("壞字x");
    expect(r.categories.sort()).toEqual(["custom", "profanity"]);
    expect(r.text).toBe("***");
  });

  it("treats empty text as allowed", async () => {
    const m = createModerator({ mode: "block", providers: [words] });
    expect((await m.check("")).action).toBe("allow");
  });
});
