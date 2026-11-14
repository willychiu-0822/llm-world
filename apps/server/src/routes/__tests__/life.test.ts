import { describe, expect, it, vi } from "vitest";
import { characters, deeds } from "@lj/db";
import { eq } from "drizzle-orm";
import { nova, userWithCharacter, useTestApp, login } from "../../test/helpers";

describe("a dragon's own life", () => {
  const env = useTestApp();
  it("has a stable, private daily story without writing on reads or granting stars", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "life@example.com");
    env.ctx.now = () => new Date("2026-11-10T15:59:00Z");
    const before = await env.ctx.db.select().from(characters);
    const a = await owner.get("/api/me/life");
    expect(a.status).toBe(200);
    expect(a.body.today.day).toBe("2026-11-10");
    expect(a.body.today.autonomous).toBeTruthy();
    expect(a.body.activities).toHaveLength(7);
    expect((await owner.get("/api/me/life")).body).toEqual(a.body);
    expect(await env.ctx.db.select().from(characters)).toEqual(before);
    env.ctx.now = () => new Date("2026-11-10T16:01:00Z");
    expect((await owner.get("/api/me/life")).body.today.day).toBe("2026-11-11");
    expect((await owner.get("/api/me")).body.pet.stars).toBe(0);
  });
  it("keeps each season's festival preview in the completed diary", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "seasonal@example.com");
    env.ctx.now = () => new Date("2026-03-10T04:00:00Z");
    const spring = (await owner.get("/api/me/life")).body;
    const springStory = spring.activities.find((a: {id: string}) => a.id === "festival").story;
    const played = (await owner.post("/api/me/life/activities").send({activityId: "festival"})).body;
    expect(played.today.entries[0].story).toBe(springStory);
    env.ctx.now = () => new Date("2026-06-10T04:00:00Z");
    const summer = (await owner.get("/api/me/life")).body;
    expect(summer.activities.find((a: {id: string}) => a.id === "festival").story).not.toBe(springStory);
    expect(summer.history.find((d: {day: string}) => d.day === "2026-03-10").entries[0].story).toBe(springStory);
  });
  it("serializes repeats, persists all activity types and keeps pet settings on concurrent writes", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "play@example.com");
    const results = await Promise.all(Array.from({length: 4}, () => owner.post("/api/me/life/activities").send({activityId: "music"})));
    expect(results.every(r => r.status === 200)).toBe(true);
    const today = (await owner.get("/api/me/life")).body;
    expect(today.today.entries).toHaveLength(1);
    expect(today.inventory).toHaveLength(1);
    await Promise.all([
      owner.post("/api/me/life/activities").send({activityId: "shop"}),
      owner.patch("/api/me/pet").send({notify: false}),
    ]);
    for (const activityId of ["exercise", "visit", "festival", "town", "abroad"]) {
      expect((await owner.post("/api/me/life/activities").send({activityId})).status).toBe(200);
    }
    const life = (await owner.get("/api/me/life")).body;
    expect(life.today.entries).toHaveLength(7);
    expect(life.inventory).toHaveLength(7);
    expect(life.activities.every((a: {done:boolean}) => a.done)).toBe(true);
    const me = (await owner.get("/api/me")).body;
    expect(me.pet.notify).toBe(false);
    expect(me.pet.stars).toBe(0);
    expect(await env.ctx.db.select().from(deeds)).toEqual([]);
    expect((await owner.put("/api/me/character").send({...nova, name: "新名字"})).status).toBe(200);
    expect((await owner.get("/api/me/life")).body.inventory).toHaveLength(7);
  });
  it("only equips owned items, keeps a bounded diary and never punishes an absence", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "wardrobe@example.com");
    expect((await owner.patch("/api/me/life").send({outfit: "shop"})).status).toBe(409);
    expect((await owner.post("/api/me/life/activities").send({activityId: "unknown"})).status).toBe(400);
    for (let i=0; i<65; i++) {
      env.ctx.now = () => new Date(Date.UTC(2026, 0, i+1, 4));
      await owner.post("/api/me/life/activities").send({activityId: "shop"});
    }
    const equipped = await owner.patch("/api/me/life").send({outfit: "shop"});
    expect(equipped.body.outfit).toBe("shop");
    expect(equipped.body.history.length).toBeLessThanOrEqual(60);
    env.ctx.now = () => new Date("2027-11-10T00:00:00Z");
    await owner.post("/api/auth/dev-login").send({ email: "wardrobe@example.com" });
    const later = (await owner.get("/api/me/life")).body;
    expect(later.inventory).toHaveLength(1);
    expect(later.outfit).toBe("shop");
    expect(later.mood).toBe("悠閒");
    expect((await owner.patch("/api/me/life").send({outfit: null})).body.outfit).toBeNull();
    const other = await userWithCharacter(env.app, "isolated@example.com");
    expect((await other.get("/api/me/life")).body.inventory).toEqual([]);
    const noDragon = await login(env.app, "no-dragon@example.com");
    expect((await noDragon.get("/api/me/life")).status).toBe(409);
  });
  it("keeps recognizable diary and keepsakes when a messy record is read and played again", async () => {
    const logs: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => { logs.push(args); });
    try {
      env.ctx.now = () => new Date("2026-03-02T04:00:00Z");
      const owner = await userWithCharacter(env.app, "messy@example.com");
      const [created] = await env.ctx.db.select().from(characters);
      const datedDays = Array.from({ length: 61 }, (_, index) => {
        const day = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
        return {
          day, autonomous: `舊日記 ${day}`, kept: true,
          entries: [
            { activityId: "shop", at: `${day}T01:00:00.000Z`, note: "scarf" },
            { activityId: "future-game", at: `${day}T02:00:00.000Z` },
            { activityId: "music", at: `${day}T03:00:00.000Z` },
            { activityId: "exercise", at: `${day}T04:00:00.000Z` },
            { activityId: "visit", at: `${day}T05:00:00.000Z` },
            { activityId: "festival", at: `${day}T06:00:00.000Z` },
            { activityId: "town", at: `${day}T07:00:00.000Z` },
            { activityId: "abroad", at: `${day}T08:00:00.000Z` },
            { activityId: "shop", at: `${day}T09:00:00.000Z`, note: "second-scarf" },
          ],
        };
      });
      const undated = { autonomous: "沒有日期", entries: [{ activityId: "shop", at: "2020-01-01T00:00:00.000Z" }] };
      const days = [...datedDays, undated];
      const inventory = [
        ...["shop", "music", "exercise", "visit", "festival", "town", "abroad"].map((activityId, index) => ({ activityId, earnedOn: `2024-04-0${index + 1}`, ribbon: activityId })),
        { activityId: "shop", earnedOn: "2024-04-08", ribbon: "second" },
        { activityId: "forged", earnedOn: "2024-04-09", ribbon: "foreign" },
      ];
      const life = { margin: "手寫", outfit: "handmade-cape", days, inventory };
      await env.ctx.db.update(characters).set({ sharing: { allowAiQuotes: true, life } }).where(eq(characters.id, created.id));
      const viewed = await owner.get("/api/me/life");
      expect(viewed.status).toBe(200);
      expect(viewed.body.inventory).toHaveLength(8);
      expect(viewed.body.history.find((item: { day: string }) => item.day === "2024-03-01").entries).toHaveLength(8);
      const played = await owner.post("/api/me/life/activities").send({ activityId: "music" });
      expect(played.status).toBe(200);
      const [saved] = await env.ctx.db.select().from(characters);
      const stored = (saved.sharing as { life: { margin: string; outfit: string; days: Array<Record<string, any>>; inventory: Array<Record<string, any>> } }).life;
      expect(stored.margin).toBe("手寫");
      expect(stored.outfit).toBe("handmade-cape");
      expect(stored.days.find(item => item.autonomous === "沒有日期")).toEqual(undated);
      for (const original of datedDays) {
        const kept = stored.days.find(item => item.day === original.day);
        expect(kept?.kept).toBe(true);
        expect(kept?.entries.filter((entry: { activityId: string; note?: string }) => entry.activityId === "shop" && entry.note === "scarf")).toHaveLength(1);
        expect(kept?.entries.filter((entry: { activityId: string; note?: string }) => entry.activityId === "shop" && entry.note === "second-scarf")).toHaveLength(1);
        expect(kept?.entries.filter((entry: { activityId: string }) => entry.activityId === "future-game")).toHaveLength(1);
        for (const activityId of ["music", "exercise", "visit", "festival", "town", "abroad"]) {
          expect(kept?.entries.filter((entry: { activityId: string }) => entry.activityId === activityId)).toHaveLength(1);
        }
      }
      expect(stored.inventory.filter(item => item.activityId === "forged")).toEqual([{ activityId: "forged", earnedOn: "2024-04-09", ribbon: "foreign" }]);
      expect(stored.inventory.filter(item => item.ribbon === "second")).toEqual([{ activityId: "shop", earnedOn: "2024-04-08", ribbon: "second" }]);
      expect(stored.inventory.filter(item => item.activityId !== "forged")).toHaveLength(8);
      expect(stored.days.some(item => item.day === "2026-03-02" && item.entries.some((entry: { activityId: string }) => entry.activityId === "music"))).toBe(true);
      expect(logs.some(args => String(args[0]).includes("life record:"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
  it("refuses to overwrite a life record it cannot migrate", async () => {
    const logs: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => { logs.push(args); });
    try {
      env.ctx.now = () => new Date("2026-03-02T04:00:00Z");
      const owner = await userWithCharacter(env.app, "wrinkled@example.com");
      const [created] = await env.ctx.db.select().from(characters);
      await env.ctx.db.update(characters).set({ sharing: { allowAiQuotes: true, life: "wrinkled page" } }).where(eq(characters.id, created.id));
      const refused = await owner.post("/api/me/life/activities").send({ activityId: "shop" });
      expect(refused.status).toBe(409);
      expect(refused.body.error.message).toContain("皺");
      const [saved] = await env.ctx.db.select().from(characters);
      expect((saved.sharing as { life: unknown }).life).toBe("wrinkled page");
      const future = { version: 2, extra: "keep", days: [{ day: "2024-05-01", autonomous: "未來的格式", entries: [{ activityId: "shop", at: "2024-05-01T01:00:00.000Z" }] }], inventory: [{ activityId: "shop", earnedOn: "2024-05-01" }] };
      await env.ctx.db.update(characters).set({ sharing: { allowAiQuotes: true, life: future } }).where(eq(characters.id, created.id));
      const blocked = await owner.post("/api/me/life/activities").send({ activityId: "music" });
      expect(blocked.status).toBe(409);
      const [again] = await env.ctx.db.select().from(characters);
      expect((again.sharing as { life: unknown }).life).toEqual(future);
      expect(logs.some(args => String(args[0]).includes("life record: refusing to overwrite"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
