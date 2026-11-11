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
});
