import request from "supertest";
import { describe, expect, it } from "vitest";
import { deeds, users } from "@lj/db";
import { eq } from "drizzle-orm";
import { nova, userWithCharacter, useTestApp } from "../../test/helpers";

describe("town, places and moderation admin", () => {
  const env = useTestApp();

  it("lists districts and public places with presence of recently active characters", async () => {
    const u = await userWithCharacter(env.app, "xiaoan@example.com");
    const w = (await u.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" })).body;
    const s = (await u.post("/api/first-steps").send({ executor: "self", text: "在家唱一首", wantId: w.id })).body;
    await u.post(`/api/first-steps/${s.id}/complete`).send({});

    const town = (await request(env.app).get("/api/town")).body;
    expect(town.districts.map((d: { key: string }) => d.key)).toEqual(["music", "sports", "crafts", "food", "learning", "outdoors", "social", "volunteer", "misc"]);
    const music = town.places.find((p: { id: string }) => p.id === "pub_music");
    expect(music).toMatchObject({ kind: "public", deedCount: 1, trialCount: 0 });
    expect(music.presence).toEqual({ total: 1, characters: [{ name: "Nova", appearance: expect.any(Object) }] });
  });

  it("shows a place with its public deeds, real ones before demo", async () => {
    const u = await userWithCharacter(env.app, "a@example.com");
    const w = (await u.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" })).body;
    const made = [];
    for (const [text, visibility] of [["公開的", "public"], ["私人的", "private"], ["示範的", "public"]] as const) {
      const s = (await u.post("/api/first-steps").send({ executor: "self", text, wantId: w.id })).body;
      made.push((await u.post(`/api/first-steps/${s.id}/complete`).send({ visibility })).body.deed);
    }
    await env.handle.db.update(deeds).set({ isDemo: true, createdAt: new Date(Date.now() + 1000) }).where(eq(deeds.id, made[2].id));
    const place = (await request(env.app).get("/api/places/pub_music")).body;
    expect(place).toMatchObject({ id: "pub_music", name: "音樂坊小廣場", districtKey: "music" });
    expect(place.deeds.map((d: { title: string }) => d.title)).toEqual(["公開的", "示範的"]);
    expect(place.deeds[1].isDemo).toBe(true);
    expect(place.deeds[0].character.name).toBe("Nova");
    expect((await u.get("/api/places/pub_music")).body.deeds[0].isMine).toBe(true);
    const visitor = await userWithCharacter(env.app, "visitor@example.com");
    expect((await visitor.get("/api/places/pub_music")).body.deeds[0].isMine).toBe(false);
    expect((await request(env.app).get("/api/places/nope")).status).toBe(404);
  });

  it("lets admins review moderation logs and remove a deed", async () => {
    const u = await userWithCharacter(env.app, "rude@example.com", { ...nova, personality: "fuck" });
    const s = (await u.post("/api/first-steps").send({ executor: "self", text: "唱歌" })).body;
    const deed = (await u.post(`/api/first-steps/${s.id}/complete`).send({})).body.deed;
    const admin = await userWithCharacter(env.app, "admin@example.com");
    const log = (await admin.get("/api/admin/moderation")).body;
    expect(log[0]).toMatchObject({ targetType: "character", action: "filter", categories: ["blocklist"] });
    expect((await admin.post(`/api/admin/deeds/${deed.id}/remove`)).status).toBe(200);
    expect((await request(env.app).get(`/api/deeds/${deed.id}`)).status).toBe(404);
  });

  it("reports basic health metrics to admins", async () => {
    const u = await userWithCharacter(env.app, "m@example.com");
    const s1 = (await u.post("/api/first-steps").send({ executor: "self", text: "a" })).body;
    await u.post("/api/first-steps").send({ executor: "ai", text: "b" });
    await u.post(`/api/first-steps/${s1.id}/complete`).send({ noteAfter: "ok", noteShared: true });
    const admin = await userWithCharacter(env.app, "admin@example.com");
    await env.handle.db.update(users).set({ isDemo: false });
    const m = (await admin.get("/api/admin/metrics")).body;
    expect(m).toMatchObject({
      users: 2,
      characters: 2,
      steps: { total: 2, confirmed: 1, done: 1, byExecutor: { ai: 1, self: 1 } },
      deeds: { total: 1, real: 1, demo: 0 },
      notes: { after: 1, shared: 1 },
    });
  });
});
