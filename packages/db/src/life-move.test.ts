import { LIFE_ACTIVITIES, readLife } from "@lj/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase } from "./base";
import { connect, type DbHandle } from "./client";
import { moveAllLegacyLife } from "./life-move";
import { runMigrations } from "./migrate";
import { characters, lifeDays, lifeItems, users } from "./schema";

const url =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_test";
let h: DbHandle;
beforeAll(async () => {
  h = connect(url, { max: 2 });
  await runMigrations(h.db);
});
beforeEach(async () => resetDatabase(h.db));
afterAll(async () => h.close());

async function dragon(id: string, sharing: unknown) {
  await h.db.insert(users).values({ id: `u_${id}`, email: `${id}@example.com` });
  await h.db
    .insert(characters)
    .values({ id, userId: `u_${id}`, name: id, appearance: {}, sharing });
}
const row = async (id: string) =>
  (await h.db.select().from(characters).where(eq(characters.id, id)))[0]!;
const daysOf = (id: string) => h.db.select().from(lifeDays).where(eq(lifeDays.characterId, id));
const itemsOf = (id: string) => h.db.select().from(lifeItems).where(eq(lifeItems.characterId, id));
const pad = (n: number) => String(n).padStart(2, "0");

/** 一個玩了 60 天、七件都帶回家的老帳號。 */
function fullSave() {
  const days = Array.from({ length: 60 }, (_, i) => {
    const day = `2026-${pad(1 + Math.floor(i / 28))}-${pad(1 + (i % 28))}`;
    return {
      day,
      autonomous: `第 ${i + 1} 天的小事`,
      entries: LIFE_ACTIVITIES.slice(0, 1 + (i % 3)).map((a) => ({
        activityId: a.id,
        at: `${day}T03:00:00.000Z`,
        storyId: `${a.id}:${i}`,
        story: `${day} 的 ${a.name}`,
      })),
    };
  });
  const inventory = LIFE_ACTIVITIES.map((a, i) => ({
    activityId: a.id,
    earnedOn: `2026-01-${pad(i + 1)}`,
  }));
  return { version: 1, days, inventory, outfit: "shop", decoration: "festival", allowVisits: true };
}

describe("LW-15: moving old saves out of sharing.life", () => {
  it("moves every diary day, entry and keepsake of an old account, and keeps the privacy setting", async () => {
    const life = fullSave();
    await dragon("old", { allowAiQuotes: false, pet: { stars: 3 }, life });
    await dragon("fresh", { allowAiQuotes: true });
    const before = readLife({ life });

    expect(await moveAllLegacyLife(h.db)).toEqual({ moved: 1, left: [] });

    const days = await daysOf("old");
    expect(days).toHaveLength(60);
    for (const original of before.days) {
      const moved = days.filter((d) => d.day === original.day);
      expect(moved).toHaveLength(1);
      expect({
        day: moved[0]!.day,
        autonomous: moved[0]!.autonomous,
        entries: moved[0]!.entries,
      }).toEqual(original);
    }
    expect(days.reduce((n, d) => n + (d.entries as unknown[]).length, 0)).toBe(
      before.days.reduce((n, d) => n + d.entries.length, 0),
    );
    expect(
      (await itemsOf("old")).map((i) => ({ activityId: i.activityId, earnedOn: i.earnedOn })),
    ).toEqual(before.inventory);
    const old = await row("old");
    expect(old.sharing).toEqual({ allowAiQuotes: false, pet: { stars: 3 } });
    expect(old).toMatchObject({
      allowVisits: true,
      lifeOutfit: "shop",
      lifeDecoration: "festival",
      lifeLegacy: [life],
    });
    const fresh = await row("fresh");
    expect(fresh).toMatchObject({
      sharing: { allowAiQuotes: true },
      allowVisits: false,
      lifeOutfit: null,
      lifeDecoration: null,
      lifeLegacy: null,
    });
    expect(await daysOf("fresh")).toHaveLength(0);

    // 再跑一次不會重複搬
    expect(await moveAllLegacyLife(h.db)).toEqual({ moved: 0, left: [] });
    expect(await daysOf("old")).toHaveLength(60);
    expect(await itemsOf("old")).toHaveLength(LIFE_ACTIVITIES.length);
  });

  it("runs as part of the migration step", async () => {
    await dragon("boot", {
      allowAiQuotes: true,
      life: {
        days: [{ day: "2026-02-01", autonomous: "曬太陽", entries: [] }],
        inventory: [{ activityId: "shop", earnedOn: "2026-02-01" }],
      },
    });
    await runMigrations(h.db);
    expect(await daysOf("boot")).toHaveLength(1);
    expect(await itemsOf("boot")).toHaveLength(1);
    expect((await row("boot")).sharing).toEqual({ allowAiQuotes: true });
  });

  it("keeps duplicates and archives what it cannot read; a broken save stays where it is", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const odd = {
        margin: "手寫",
        outfit: "handmade-cape",
        days: [
          {
            day: "2024-03-01",
            autonomous: "a",
            entries: [
              { activityId: "shop", at: "2024-03-01T01:00:00.000Z" },
              { activityId: "shop", at: "2024-03-01T02:00:00.000Z" },
              { activityId: "future-game", at: "x" },
            ],
          },
          { day: "2024-03-01", autonomous: "同一天寫了兩頁", entries: [] },
          { autonomous: "沒有日期", entries: [] },
        ],
        inventory: [
          { activityId: "shop", earnedOn: "2024-03-01" },
          { activityId: "shop", earnedOn: "2024-03-02" },
          { activityId: "forged", earnedOn: "2024-03-03" },
        ],
      };
      const future = { version: 2, days: [{ day: "2024-05-01", autonomous: "未來", entries: [] }] };
      await dragon("odd", { allowAiQuotes: true, life: odd });
      await dragon("wrinkled", { allowAiQuotes: true, life: "wrinkled page" });
      await dragon("future", { allowAiQuotes: true, life: future });

      const result = await moveAllLegacyLife(h.db);
      expect(result.moved).toBe(1);
      expect(result.left.sort()).toEqual(["future", "wrinkled"]);

      const days = await daysOf("odd");
      expect(days).toHaveLength(2);
      expect(days.map((d) => (d.entries as unknown[]).length).sort()).toEqual([0, 2]);
      expect(await itemsOf("odd")).toHaveLength(2);
      const moved = await row("odd");
      expect(moved.lifeLegacy).toEqual([odd]);
      expect(moved.lifeOutfit).toBeNull();
      expect((await row("wrinkled")).sharing).toEqual({
        allowAiQuotes: true,
        life: "wrinkled page",
      });
      expect((await row("future")).sharing).toEqual({ allowAiQuotes: true, life: future });
      expect((await row("future")).lifeLegacy).toBeNull();
      expect(await daysOf("future")).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("merges only what is missing when an older server wrote sharing.life again after the move", async () => {
    const first = {
      days: [
        {
          day: "2026-02-01",
          autonomous: "曬太陽",
          entries: [{ activityId: "shop", at: "2026-02-01T03:00:00.000Z" }],
        },
      ],
      inventory: [{ activityId: "shop", earnedOn: "2026-02-01" }],
      outfit: "shop",
      allowVisits: true,
    };
    await dragon("roll", { allowAiQuotes: true, life: first });
    await moveAllLegacyLife(h.db);
    const late = {
      version: 1,
      outfit: null,
      allowVisits: false,
      days: [
        {
          day: "2026-02-01",
          autonomous: "",
          entries: [
            { activityId: "shop", at: "2026-02-01T09:00:00.000Z" },
            { activityId: "music", at: "2026-02-01T10:00:00.000Z" },
          ],
        },
        {
          day: "2026-02-02",
          autonomous: "新的一天",
          entries: [{ activityId: "music", at: "2026-02-02T03:00:00.000Z" }],
        },
      ],
      inventory: [
        { activityId: "shop", earnedOn: "2026-02-02" },
        { activityId: "music", earnedOn: "2026-02-01" },
      ],
    };
    await h.db
      .update(characters)
      .set({ sharing: { allowAiQuotes: true, life: late } })
      .where(eq(characters.id, "roll"));

    expect(await moveAllLegacyLife(h.db)).toEqual({ moved: 1, left: [] });

    const days = (await daysOf("roll")).sort((a, b) => a.day.localeCompare(b.day));
    expect(days.map((d) => d.day)).toEqual(["2026-02-01", "2026-02-02"]);
    expect(days[0]!.autonomous).toBe("曬太陽");
    expect(days[0]!.entries).toEqual([
      { activityId: "shop", at: "2026-02-01T03:00:00.000Z" },
      { activityId: "music", at: "2026-02-01T10:00:00.000Z" },
    ]);
    expect((await itemsOf("roll")).map((i) => `${i.activityId}:${i.earnedOn}`).sort()).toEqual([
      "music:2026-02-01",
      "shop:2026-02-01",
    ]);
    const after = await row("roll");
    expect(after).toMatchObject({
      sharing: { allowAiQuotes: true },
      allowVisits: true,
      lifeOutfit: "shop",
      lifeLegacy: [first, late],
    });
  });
});
