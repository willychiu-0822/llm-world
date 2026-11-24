import { describe, expect, it, vi } from "vitest";
import { autonomousLife, LIFE_ACTIVITIES, LIFE_INVENTORY_CAP, lifeClock, lifeScene, lifeStateSchema, migrateLifeState, parseLife, readLife } from "./life";

describe("Taipei's little everyday world", () => {
  it("uses the Taipei midnight and all four seasons and periods", () => {
    expect(lifeClock(new Date("2026-11-10T15:59:59Z")).day).toBe("2026-11-10");
    expect(lifeClock(new Date("2026-11-10T16:00:00Z")).day).toBe("2026-11-11");
    const scenes = ["2026-03-10T00:00:00Z", "2026-06-10T04:00:00Z", "2026-09-10T10:00:00Z", "2026-12-10T15:00:00Z"].map(s => lifeScene(new Date(s)));
    for (const [i, word] of ["春天的早晨", "夏天的午後", "秋天的傍晚", "冬天的夜裡"].entries()) expect(scenes[i]).toContain(word);
    expect(new Set(scenes).size).toBe(4);
    expect(autonomousLife("dragon", "2026-11-10")).toBe(autonomousLife("dragon", "2026-11-10"));
  });
  it("reads legacy characters without enabling visits or inventing owned rewards", () => {
    expect(readLife({allowAiQuotes:true})).toMatchObject({allowVisits:false,inventory:[],outfit:null,decoration:null});
    expect(readLife({life:{inventory:[{activityId:"forged"}]}}).inventory).toEqual([]);
  });
  it("keeps recognised diary entries and collection items when old data has an unknown activity or is over the cap, and logs the skip", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const life = readLife({ life: legacyLife() });
      expect(life.days.map(d => ({ day: d.day, autonomous: d.autonomous, entries: d.entries }))).toEqual([
        { day: "2026-11-10", autonomous: "早些時候，小龍在舊市集晃了一圈。", entries: [
          { activityId: "shop", at: "2026-11-10T01:00:00.000Z" },
          { activityId: "music", at: "2026-11-10T03:00:00.000Z" },
        ] },
        { day: "2026-11-09", autonomous: "早些時候，小龍把葉子吹到河對岸。", entries: [
          { activityId: "exercise", at: "2026-11-09T01:00:00.000Z" },
          { activityId: "visit", at: "2026-11-09T02:00:00.000Z" },
          { activityId: "festival", at: "2026-11-09T03:00:00.000Z" },
          { activityId: "town", at: "2026-11-09T04:00:00.000Z" },
          { activityId: "abroad", at: "2026-11-09T05:00:00.000Z" },
          { activityId: "shop", at: "2026-11-09T06:00:00.000Z" },
          { activityId: "music", at: "2026-11-09T07:00:00.000Z" },
          { activityId: "exercise", at: "2026-11-09T08:00:00.000Z" },
        ] },
      ]);
      expect(life.inventory).toEqual([
        { activityId: "shop", earnedOn: "2026-11-09" },
        { activityId: "exercise", earnedOn: "2026-11-09" },
        { activityId: "music", earnedOn: "2026-11-09" },
        { activityId: "visit", earnedOn: "2026-11-09" },
        { activityId: "festival", earnedOn: "2026-11-09" },
        { activityId: "town", earnedOn: "2026-11-09" },
        { activityId: "abroad", earnedOn: "2026-11-09" },
        { activityId: "shop", earnedOn: "2026-11-01" },
      ]);
      expect(life.outfit).toBe("shop");
      expect(life.decoration).toBe("festival");
      expect(life.allowVisits).toBe(true);
      const logged = [...warn.mock.calls, ...error.mock.calls].flat().map(String).join("\n");
      expect(logged).toContain("old-market");
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
  it("upgrades older life documents one version at a time and refuses a newer document", () => {
    const step = { from: 1, to: 2, migrate: (doc: Record<string, unknown>) => ({ ...doc, moved: true }) };
    expect(migrateLifeState({ version: 1, days: [] }, [step], 2)).toEqual({ ok: true, document: { version: 2, days: [], moved: true } });
    expect(migrateLifeState({ allowVisits: false })).toMatchObject({ ok: true, document: { version: 1, allowVisits: false } });
    expect(migrateLifeState({ version: 2 }).ok).toBe(false);
    expect(LIFE_INVENTORY_CAP).toBe(LIFE_ACTIVITIES.length);
    expect(lifeStateSchema.safeParse({ inventory: LIFE_ACTIVITIES.map(a => ({ activityId: a.id, earnedOn: "2026-11-10" })) }).success).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const sharing = { life: { version: 2, inventory: [{ activityId: "shop", earnedOn: "2026-11-10" }] } };
      expect(parseLife(sharing).ok).toBe(false);
      expect(readLife(sharing).inventory).toEqual([]);
      expect([...warn.mock.calls, ...error.mock.calls].flat().map(String).join("\n").length).toBeGreaterThan(0);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

/** Old saved life: an activity id this build does not know, plus more entries and collection items than the old cap of 7. */
function legacyLife() {
  return {
    version: 1,
    days: [
      {
        day: "2026-11-10",
        autonomous: "早些時候，小龍在舊市集晃了一圈。",
        entries: [
          { activityId: "shop", at: "2026-11-10T01:00:00.000Z" },
          { activityId: "old-market", at: "2026-11-10T02:00:00.000Z" },
          { activityId: "music", at: "2026-11-10T03:00:00.000Z" },
        ],
      },
      {
        day: "2026-11-09",
        autonomous: "早些時候，小龍把葉子吹到河對岸。",
        entries: [
          { activityId: "exercise", at: "2026-11-09T01:00:00.000Z" },
          { activityId: "visit", at: "2026-11-09T02:00:00.000Z" },
          { activityId: "festival", at: "2026-11-09T03:00:00.000Z" },
          { activityId: "town", at: "2026-11-09T04:00:00.000Z" },
          { activityId: "abroad", at: "2026-11-09T05:00:00.000Z" },
          { activityId: "shop", at: "2026-11-09T06:00:00.000Z" },
          { activityId: "music", at: "2026-11-09T07:00:00.000Z" },
          { activityId: "exercise", at: "2026-11-09T08:00:00.000Z" },
        ],
      },
    ],
    inventory: [
      { activityId: "shop", earnedOn: "2026-11-09" },
      { activityId: "exercise", earnedOn: "2026-11-09" },
      { activityId: "music", earnedOn: "2026-11-09" },
      { activityId: "visit", earnedOn: "2026-11-09" },
      { activityId: "festival", earnedOn: "2026-11-09" },
      { activityId: "town", earnedOn: "2026-11-09" },
      { activityId: "abroad", earnedOn: "2026-11-09" },
      { activityId: "old-market", earnedOn: "2026-11-08" },
      { activityId: "shop", earnedOn: "2026-11-01" },
    ],
    outfit: "shop",
    decoration: "festival",
    allowVisits: true,
  };
}
