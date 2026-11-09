import { describe, expect, it } from "vitest";
import { rankCandidates, type Candidate } from "./curation";

const now = new Date("2026-11-01T00:00:00Z");
const day = 86400000;
const base = (o: Partial<Candidate>): Candidate => ({
  kind: "deed",
  id: "x",
  districtKey: "music",
  text: "",
  createdAt: new Date(now.getTime() - day),
  isDemo: false,
  ...o,
});

const ctx = { wants: [{ text: "想在別人面前唱一首歌", districtKey: "music" }], seenIds: new Set<string>(), selfUserId: "me", now };

describe("rankCandidates", () => {
  it("prefers candidates in the want's district", () => {
    const r = rankCandidates([base({ id: "run", districtKey: "sports", text: "去跑步" }), base({ id: "sing", text: "去上聲樂課" })], ctx);
    expect(r.map((c) => c.id)).toEqual(["sing"]);
  });

  it("prefers someone's first time over a repeat", () => {
    const r = rankCandidates([base({ id: "again", text: "第十次唱歌" }), base({ id: "first", text: "第一次唱歌", isFirst: true })], ctx);
    expect(r[0].id).toBe("first");
  });

  it("uses text similarity with the want", () => {
    const r = rankCandidates(
      [base({ id: "a", text: "學吉他" }), base({ id: "b", text: "第一次在別人面前唱歌" })],
      ctx,
    );
    expect(r[0].id).toBe("b");
  });

  it("prefers short, exit-anytime trials as a smaller first step", () => {
    const r = rankCandidates(
      [
        base({ id: "long", kind: "trial", text: "聲樂課", durationMin: 180 }),
        base({ id: "short", kind: "trial", text: "聲樂課", durationMin: 60, exitAnytime: true }),
      ],
      ctx,
    );
    expect(r[0].id).toBe("short");
  });

  it("pushes seen items down and excludes the user's own deeds", () => {
    const r = rankCandidates(
      [base({ id: "seen", text: "唱歌" }), base({ id: "fresh", text: "唱歌" }), base({ id: "mine", text: "唱歌", ownerId: "me" })],
      { ...ctx, seenIds: new Set(["seen"]) },
    );
    expect(r.map((c) => c.id)).toEqual(["fresh", "seen"]);
  });

  it("always ranks real content before demo content", () => {
    const r = rankCandidates(
      [base({ id: "demo", text: "第一次在別人面前唱歌", isFirst: true, isDemo: true }), base({ id: "real", text: "唱歌", createdAt: new Date(now.getTime() - 60 * day) })],
      ctx,
    );
    expect(r.map((c) => c.id)).toEqual(["real", "demo"]);
  });

  it("returns everything by freshness when the user has no wants", () => {
    const r = rankCandidates(
      [base({ id: "old", createdAt: new Date(now.getTime() - 20 * day) }), base({ id: "new", districtKey: "food" })],
      { ...ctx, wants: [] },
    );
    expect(r.map((c) => c.id)).toEqual(["new", "old"]);
  });

  it("respects the limit and returns reasons", () => {
    const r = rankCandidates([base({ id: "1", isFirst: true }), base({ id: "2" }), base({ id: "3" })], ctx, 2);
    expect(r).toHaveLength(2);
    expect(r[0].reasons).toContain("first_time");
    expect(r[0].reasons).toContain("same_district");
  });
});
