import { describe, expect, it } from "vitest";
import { bannedHits } from "./keepsake";
import {
  autonomousLife,
  commitLife,
  LIFE_ACTIVITIES,
  lifeAllCopy,
  lifeApplyPlay,
  lifeClock,
  lifeEntryStory,
  lifePlan,
  lifeScene,
  migrateLife,
  readLife,
  type LifeActivityId,
  type LifeState,
} from "./life";

describe("龍角鎮的回禮", () => {
  it("回禮都是拿得到的東西，而且說得出是誰做的小事", () => {
    for (const a of LIFE_ACTIVITIES) {
      expect(a.giver.length, a.id).toBeGreaterThan(0);
      expect(a.origin.length, a.id).toBeGreaterThan(5);
    }
    expect(LIFE_ACTIVITIES.find((a) => a.id === "visit")).toMatchObject({
      reward: "小栗的茶杯墊",
      category: "朋友送的",
      giver: "小栗",
    });
  });
  it("生活頁文案沒有影像類的回禮", () => {
    expect(bannedHits("茶會合照 朋友相簿 照片 相片 拍照 明信片")).toEqual(
      expect.arrayContaining(["合照", "相簿", "照片", "相片", "拍照", "明信片"]),
    );
    const copy = lifeAllCopy();
    expect(copy.length).toBeGreaterThan(30);
    for (const line of copy)
      for (const word of ["合照", "相簿", "照片", "相片", "拍照", "明信片"])
        expect(line, line).not.toContain(word);
  });
});

describe("Taipei's little everyday world", () => {
  it("uses the Taipei midnight and all four seasons and periods", () => {
    expect(lifeClock(new Date("2026-11-10T15:59:59Z")).day).toBe("2026-11-10");
    expect(lifeClock(new Date("2026-11-10T16:00:00Z")).day).toBe("2026-11-11");
    const scenes = [
      "2026-03-10T00:00:00Z",
      "2026-06-10T04:00:00Z",
      "2026-09-10T10:00:00Z",
      "2026-12-10T15:00:00Z",
    ].map((s) => lifeScene(new Date(s)));
    for (const [i, word] of ["春天的早晨", "夏天的午後", "秋天的傍晚", "冬天的夜裡"].entries())
      expect(scenes[i]).toContain(word);
    expect(new Set(scenes).size).toBe(4);
    expect(autonomousLife("dragon", "2026-11-10")).toBe(autonomousLife("dragon", "2026-11-10"));
  });
  it("reads legacy characters without enabling visits or inventing owned rewards", () => {
    expect(readLife({ allowAiQuotes: true })).toMatchObject({
      allowVisits: false,
      inventory: [],
      outfit: null,
      decoration: null,
    });
    expect(readLife({ life: { inventory: [{ activityId: "forged" }] } }).inventory).toEqual([]);
  });
  it("keeps recognizable diary and keepsakes when old data is over the cap or partly unknown", () => {
    const day = {
      day: "2024-01-01",
      autonomous: "舊的一天",
      kept: true,
      entries: [
        { activityId: "shop", at: "2024-01-01T01:00:00.000Z", note: "scarf" },
        { activityId: "future-game", at: "2024-01-01T02:00:00.000Z" },
        ...Array.from({ length: 7 }, (_, index) => ({
          activityId: "music",
          at: `2024-01-01T0${index + 3}:00:00.000Z`,
        })),
      ],
    };
    const inventory = [
      ...Array.from({ length: 8 }, (_, index) => ({
        activityId: index % 2 ? "music" : "shop",
        earnedOn: `2024-01-${String(index + 1).padStart(2, "0")}`,
        ribbon: index,
      })),
      { activityId: "forged", earnedOn: "2024-01-09" },
    ];
    const sharing = {
      life: {
        margin: "手寫",
        outfit: "handmade-cape",
        days: [day, { autonomous: "沒有日期" }],
        inventory,
      },
    };
    const record = migrateLife(sharing);
    expect(record.canWrite).toBe(true);
    expect(record.issues.length).toBeGreaterThan(0);
    expect(record.state.days[0]?.entries).toHaveLength(8);
    expect(record.state.inventory).toHaveLength(8);
    expect(record.state.outfit).toBeNull();
    const before = structuredClone(record.state);
    record.state.days.unshift({
      day: "2026-03-02",
      autonomous: "新的一天",
      entries: [{ activityId: "visit", at: "2026-03-02T04:00:00.000Z" }],
    });
    record.state.inventory.push({ activityId: "visit", earnedOn: "2026-03-02" });
    const stored = commitLife(record, before, record.state);
    expect(stored.margin).toBe("手寫");
    expect(stored.outfit).toBe("handmade-cape");
    const storedDays = stored.days as Array<Record<string, unknown>>;
    expect(storedDays.find((item) => item.autonomous === "沒有日期")).toEqual({
      autonomous: "沒有日期",
    });
    const kept = storedDays.find((item) => item.day === "2024-01-01") as {
      kept?: boolean;
      entries: Array<Record<string, unknown>>;
    };
    expect(kept.kept).toBe(true);
    expect(
      kept.entries.filter((entry) => entry.activityId === "shop" && entry.note === "scarf"),
    ).toHaveLength(1);
    expect(kept.entries.filter((entry) => entry.activityId === "future-game")).toHaveLength(1);
    expect(kept.entries.filter((entry) => entry.activityId === "music")).toHaveLength(7);
    const storedInventory = stored.inventory as Array<Record<string, unknown>>;
    expect(storedInventory.filter((item) => item.activityId === "forged")).toEqual([
      { activityId: "forged", earnedOn: "2024-01-09" },
    ]);
    expect(
      storedInventory.filter((item) => item.activityId === "shop" || item.activityId === "music"),
    ).toHaveLength(8);
    expect(storedInventory.some((item) => item.activityId === "visit")).toBe(true);
  });
  it("refuses to treat an unknown version or a non-object as an empty diary", () => {
    expect(migrateLife({ life: "wrinkled" }).canWrite).toBe(false);
    const future = migrateLife({
      life: {
        version: 2,
        days: [
          {
            day: "2024-05-01",
            autonomous: "未來",
            entries: [{ activityId: "shop", at: "2024-05-01T00:00:00.000Z" }],
          },
        ],
      },
    });
    expect(future.canWrite).toBe(false);
    expect(future.state.days).toHaveLength(1);
    expect(migrateLife({ allowAiQuotes: true }).canWrite).toBe(true);
  });

  describe("daily places and stories", () => {
    const at = (n: number) => new Date(Date.UTC(2026, 3, 1 + n, 4));
    const fresh = () => readLife({});
    function visit(life: LifeState, id: string, now: Date, only?: LifeActivityId[]) {
      const { day } = lifeClock(now);
      if (!life.days.find((d) => d.day === day))
        life.days.push({ day, autonomous: "x", entries: [] });
      const played: LifeActivityId[] = [];
      for (const a of lifePlan(id, now, life).open)
        if ((!only || only.includes(a)) && lifeApplyPlay(id, now, life, a) === "played")
          played.push(a);
      return played;
    }
    it("opens at most two places on the first day and keeps the others closed", () => {
      const life = fresh();
      const plan = lifePlan("dragon", at(0), life);
      expect(plan.open.length).toBeLessThanOrEqual(2);
      const closed = LIFE_ACTIVITIES.map((a) => a.id).find((a) => !plan.open.includes(a))!;
      visit(life, "dragon", at(0));
      expect(life.inventory.length).toBe(2);
      expect(lifeApplyPlay("dragon", at(0), life, closed)).toBe("closed");
      expect(life.inventory.length).toBe(2);
    });
    it("needs at least five different days to collect all seven, however they are spread", () => {
      for (const gap of [1, 3, 40]) {
        const life = fresh();
        let days = 0;
        while (life.inventory.length < 7 && days < 20) visit(life, "dragon", at(days++ * gap));
        expect(days).toBe(5);
      }
    });
    it("gives an unseen story every day for a week, and never blocks play after that", () => {
      const life = fresh();
      for (let d = 0; d < 7; d++) {
        const before = new Set(life.days.flatMap((x) => x.entries.map((e) => e.storyId)));
        const now = at(d);
        const plan = lifePlan("dragon", now, life);
        expect(plan.open.length).toBeGreaterThan(0);
        expect(plan.open.some((id) => !before.has(plan.stories[id]!.storyId))).toBe(true);
        visit(life, "dragon", now);
      }
      for (let d = 7; d < 60; d++) expect(visit(life, "dragon", at(d)).length).toBeGreaterThan(0);
    });
    it("keeps the story text it wrote, and old entries without one read as before", () => {
      const life = fresh();
      visit(life, "dragon", at(0));
      const e = life.days[0]!.entries[0]!;
      expect(e.story).toBeTruthy();
      expect(lifeEntryStory(e)).toBe(e.story);
      expect(lifeEntryStory({ activityId: "shop", at: at(0).toISOString() })).toContain("雲朵圍巾");
    });
    it("writes story fields back to the stored record, also for a second visit on the same day", () => {
      const now = at(0);
      const first = readLife({}),
        id = "dragon";
      const { day } = lifeClock(now);
      first.days.push({ day, autonomous: "x", entries: [] });
      const [a, b] = lifePlan(id, now, first).open;
      lifeApplyPlay(id, now, first, a!);
      const rec1 = migrateLife({ life: commitLife(migrateLife({}), readLife({}), first) });
      const second = structuredClone(rec1.state);
      const before = structuredClone(second);
      lifeApplyPlay(id, now, second, b!);
      const stored = commitLife(rec1, before, second);
      const back = migrateLife({ life: stored }).state.days[0]!.entries;
      expect(back).toHaveLength(2);
      for (const x of back) {
        expect(x.storyId).toBeTruthy();
        expect(x.story).toBeTruthy();
      }
      expect(
        (stored.days as Array<{ entries: Array<{ story?: string }> }>)[0]!.entries.every(
          (x) => typeof x.story === "string",
        ),
      ).toBe(true);
    });
  });
});
