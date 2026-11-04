import { deeds, places, providers, trials, users } from "@lj/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { purgeDemo } from "../services/admin";
import { userWithCharacter, useTestApp } from "../test/helpers";
import { seedDemo } from "./demo";

describe("demo content", () => {
  const env = useTestApp();

  it("seeds clearly labelled demo content in every district, idempotently", async () => {
    const first = await seedDemo(env.ctx);
    expect(first.created).toBe(true);
    const again = await seedDemo(env.ctx);
    expect(again.created).toBe(false);

    const all = await env.handle.db.select().from(deeds);
    expect(all.length).toBeGreaterThanOrEqual(9);
    expect(all.every((d) => d.isDemo)).toBe(true);
    expect(new Set(all.map((d) => d.districtKey)).size).toBe(9);
    expect((await env.handle.db.select().from(users).where(eq(users.isDemo, false))).length).toBe(0);
    const ps = await env.handle.db.select().from(providers);
    expect(ps.every((p) => p.isDemo && p.status === "approved")).toBe(true);
    expect((await env.handle.db.select().from(trials)).every((t) => t.isDemo)).toBe(true);

    const town = (await request(env.app).get("/api/town")).body;
    expect(town.places.filter((p: { kind: string }) => p.kind === "shop").every((p: { isDemo: boolean }) => p.isDemo)).toBe(true);
    const trial = (await env.handle.db.select().from(trials))[0];
    const view = (await request(env.app).get(`/api/trials/${trial.id}`)).body;
    expect(view.isDemo).toBe(true);
    expect(view.sessions.length).toBeGreaterThan(0);
  });

  it("purges demo content and keeps real deeds that used demo shops", async () => {
    await seedDemo(env.ctx);
    const [trial] = await env.handle.db.select().from(trials).where(eq(trials.isDemo, true));
    const real = await userWithCharacter(env.app, "real@example.com");
    const s = (await real.post("/api/first-steps").send({ executor: "self", text: "去示範店試試", trialId: trial.id })).body;
    const deed = (await real.post(`/api/first-steps/${s.id}/complete`).send({})).body.deed;
    expect(deed.isDemo).toBe(false);

    const out = await purgeDemo(env.ctx);
    expect(out.users).toBeGreaterThan(0);
    expect(await env.handle.db.select().from(providers)).toHaveLength(0);
    expect((await env.handle.db.select().from(places)).every((p) => p.kind === "public")).toBe(true);
    const kept = await env.handle.db.select().from(deeds);
    expect(kept.map((d) => d.id)).toEqual([deed.id]);
    expect(kept[0].placeId).toMatch(/^pub_/);
    expect(kept[0].trialId).toBeNull();
  });
});
