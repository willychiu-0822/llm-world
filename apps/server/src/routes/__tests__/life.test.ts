import { describe, expect, it, vi } from "vitest";
import { characters, deeds } from "@lj/db";
import { eq, sql } from "drizzle-orm";
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

  async function sharedDeed(email: string, name: string, title: string) {
    const agent = await userWithCharacter(env.app, email, { ...nova, name });
    const w = (await agent.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" })).body;
    const s = (await agent.post("/api/first-steps").send({ executor: "self", text: title, wantId: w.id })).body;
    const deed = (await agent.post(`/api/first-steps/${s.id}/complete`).send({ noteAfter: "只有我知道的私事 A123", noteShared: false })).body.deed;
    return { agent, deed };
  }

  it("G9: visits are off by default, need an explicit opt-in, and never leak private details", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00Z");
    const me = await userWithCharacter(env.app, "me@example.com", { ...nova, name: "我家小龍" });
    const friend = await userWithCharacter(env.app, "friend@example.com", { ...nova, name: "阿綠" });
    const first = (await me.get("/api/me/life")).body;
    expect(first.allowVisits).toBe(false);
    expect(first.encounter).toEqual({ kind: "town", name: "小栗" });
    // 朋友預設不串門，所以不會被選到
    expect((await friend.get("/api/me/life")).body.allowVisits).toBe(false);
    expect((await me.get("/api/me/life")).body.encounter.kind).toBe("town");
    // 朋友同意後才會遇到
    expect((await friend.patch("/api/me/life").send({ allowVisits: true })).body.allowVisits).toBe(true);
    const met = (await me.get("/api/me/life")).body;
    expect(met.encounter).toMatchObject({ kind: "player", name: "阿綠", appearance: { body: "round" } });
    expect(JSON.stringify(met)).not.toContain("friend@example.com");
    expect(Object.keys(met.encounter).sort()).toEqual(["appearance", "kind", "name"]);
    expect((await me.get("/api/me/life")).body.encounter).toEqual(met.encounter); // 同一天穩定
    // 不會遇到自己
    expect((await friend.get("/api/me/life")).body.encounter.kind).toBe("town");
    // 結果日記沒有複製對方資料
    const played = (await me.post("/api/me/life/activities").send({ activityId: "visit" })).body;
    expect(played.encounter.name).toBe("阿綠");
    const stored = (await env.ctx.db.select().from(characters).where(eq(characters.name, "我家小龍")))[0]!;
    expect(JSON.stringify(stored.sharing)).not.toContain("阿綠");
    // 撤回後未來不再出現
    expect((await friend.patch("/api/me/life").send({ allowVisits: false })).body.allowVisits).toBe(false);
    expect((await me.get("/api/me/life")).body.encounter).toEqual({ kind: "town", name: "小栗" });
    expect((await friend.patch("/api/me/life").send({ allowVisits: "yes" })).status).toBe(400);
  });

  it("G10: the town-heart entry only shows public, unremoved deeds from other people and vanishes when pulled", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00Z");
    const me = await userWithCharacter(env.app, "me2@example.com");
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    const own = await sharedDeed("own@example.com", "小米", "去上一次聲樂試用課");
    const seen = (await me.get("/api/me/life")).body.inspiration;
    expect(seen).toMatchObject({ title: "去上一次聲樂試用課", who: "小米", placeId: own.deed.placeId, isDemo: false });
    expect(JSON.stringify(seen)).not.toContain("A123");
    expect(JSON.stringify(seen)).not.toContain("own@example.com");
    expect((await own.agent.get("/api/me/life")).body.inspiration).toBeNull(); // 看不到自己的
    // 設成私密後立刻消失
    expect((await own.agent.patch(`/api/deeds/${own.deed.id}`).send({ visibility: "private" })).status).toBe(200);
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    await own.agent.patch(`/api/deeds/${own.deed.id}`).send({ visibility: "public" });
    expect((await me.get("/api/me/life")).body.inspiration?.title).toBe("去上一次聲樂試用課");
    // 管理者下架後消失
    const admin = await login(env.app, "admin@example.com");
    expect((await admin.post(`/api/admin/deeds/${own.deed.id}/remove`)).status).toBe(200);
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    // 讀取不寫入，也沒有生成任何真人事蹟或星星
    expect((await me.get("/api/me")).body.pet.stars).toBe(0);
  });

  it("keeps recognised diary entries and collection items after reading and playing old data", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00.000Z");
    const owner = await userWithCharacter(env.app, "legacy-life@example.com");
    const legacy = legacyLife();
    await env.ctx.db.update(characters).set({
      sharing: sql`jsonb_set(${characters.sharing}, '{life}', ${JSON.stringify(legacy)}::jsonb)`,
    }).where(eq(characters.name, "Nova"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await owner.get("/api/me/life")).status).toBe(200);
      const played = await owner.post("/api/me/life/activities").send({ activityId: "visit" });
      expect(played.status).toBe(200);
      const stored = (await env.ctx.db.select().from(characters).where(eq(characters.name, "Nova")))[0]!.sharing as { life: ReturnType<typeof legacyLife> };
      const life = stored.life;
      const knownEntries = (entries: Array<{ activityId: string; at: string }>) => entries.filter(e => e.activityId !== "old-market");
      expect(life.days.map(d => ({ day: d.day, autonomous: d.autonomous, entries: knownEntries(d.entries) }))).toEqual([
        { day: "2026-11-10", autonomous: legacy.days[0]!.autonomous, entries: [
          { activityId: "shop", at: "2026-11-10T01:00:00.000Z" },
          { activityId: "music", at: "2026-11-10T03:00:00.000Z" },
          { activityId: "visit", at: "2026-11-10T04:00:00.000Z" },
        ] },
        { day: "2026-11-09", autonomous: legacy.days[1]!.autonomous, entries: legacy.days[1]!.entries },
      ]);
      expect(life.inventory.filter(i => i.activityId !== "old-market")).toEqual(legacy.inventory.filter(i => i.activityId !== "old-market"));
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

  it("logs a life parse failure and does not write over the stored diary", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00.000Z");
    const owner = await userWithCharacter(env.app, "future-life@example.com");
    const legacy = { version: 2, days: legacyLife().days, inventory: legacyLife().inventory, outfit: "shop", decoration: "festival", allowVisits: true };
    await env.ctx.db.update(characters).set({
      sharing: sql`jsonb_set(${characters.sharing}, '{life}', ${JSON.stringify(legacy)}::jsonb)`,
    }).where(eq(characters.name, "Nova"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const played = await owner.post("/api/me/life/activities").send({ activityId: "music" });
      expect(played.status).toBeGreaterThanOrEqual(400);
      const stored = (await env.ctx.db.select().from(characters).where(eq(characters.name, "Nova")))[0]!.sharing as { life: typeof legacy };
      expect(stored.life).toEqual(legacy);
      const logged = [...warn.mock.calls, ...error.mock.calls].flat().map(String).join("\n");
      expect(logged.length).toBeGreaterThan(0);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

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
    outfit: "shop" as const,
    decoration: "festival" as const,
    allowVisits: true,
  };
}
