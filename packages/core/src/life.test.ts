import { describe, expect, it } from "vitest";
import { autonomousLife, commitLife, lifeClock, lifeScene, migrateLife, readLife } from "./life";

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
  it("keeps recognizable diary and keepsakes when old data is over the cap or partly unknown", () => {
    const day = {
      day: "2024-01-01", autonomous: "舊的一天", kept: true,
      entries: [
        { activityId: "shop", at: "2024-01-01T01:00:00.000Z", note: "scarf" },
        { activityId: "future-game", at: "2024-01-01T02:00:00.000Z" },
        ...Array.from({ length: 7 }, (_, index) => ({ activityId: "music", at: `2024-01-01T0${index + 3}:00:00.000Z` })),
      ],
    };
    const inventory = [
      ...Array.from({ length: 8 }, (_, index) => ({ activityId: index % 2 ? "music" : "shop", earnedOn: `2024-01-${String(index + 1).padStart(2, "0")}`, ribbon: index })),
      { activityId: "forged", earnedOn: "2024-01-09" },
    ];
    const sharing = { life: { margin: "手寫", outfit: "handmade-cape", days: [day, { autonomous: "沒有日期" }], inventory } };
    const record = migrateLife(sharing);
    expect(record.canWrite).toBe(true);
    expect(record.issues.length).toBeGreaterThan(0);
    expect(record.state.days[0]?.entries).toHaveLength(8);
    expect(record.state.inventory).toHaveLength(8);
    expect(record.state.outfit).toBeNull();
    const before = structuredClone(record.state);
    record.state.days.unshift({ day: "2026-03-02", autonomous: "新的一天", entries: [{ activityId: "visit", at: "2026-03-02T04:00:00.000Z" }] });
    record.state.inventory.push({ activityId: "visit", earnedOn: "2026-03-02" });
    const stored = commitLife(record, before, record.state);
    expect(stored.margin).toBe("手寫");
    expect(stored.outfit).toBe("handmade-cape");
    const storedDays = stored.days as Array<Record<string, unknown>>;
    expect(storedDays.find(item => item.autonomous === "沒有日期")).toEqual({ autonomous: "沒有日期" });
    const kept = storedDays.find(item => item.day === "2024-01-01") as { kept?: boolean; entries: Array<Record<string, unknown>> };
    expect(kept.kept).toBe(true);
    expect(kept.entries.filter(entry => entry.activityId === "shop" && entry.note === "scarf")).toHaveLength(1);
    expect(kept.entries.filter(entry => entry.activityId === "future-game")).toHaveLength(1);
    expect(kept.entries.filter(entry => entry.activityId === "music")).toHaveLength(7);
    const storedInventory = stored.inventory as Array<Record<string, unknown>>;
    expect(storedInventory.filter(item => item.activityId === "forged")).toEqual([{ activityId: "forged", earnedOn: "2024-01-09" }]);
    expect(storedInventory.filter(item => item.activityId === "shop" || item.activityId === "music")).toHaveLength(8);
    expect(storedInventory.some(item => item.activityId === "visit")).toBe(true);
  });
  it("refuses to treat an unknown version or a non-object as an empty diary", () => {
    expect(migrateLife({ life: "wrinkled" }).canWrite).toBe(false);
    const future = migrateLife({ life: { version: 2, days: [{ day: "2024-05-01", autonomous: "未來", entries: [{ activityId: "shop", at: "2024-05-01T00:00:00.000Z" }] }] } });
    expect(future.canWrite).toBe(false);
    expect(future.state.days).toHaveLength(1);
    expect(migrateLife({ allowAiQuotes: true }).canWrite).toBe(true);
  });
});
