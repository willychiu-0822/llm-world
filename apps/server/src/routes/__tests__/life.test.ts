import { describe, expect, it } from "vitest";
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
});
