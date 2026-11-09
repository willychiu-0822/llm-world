import { users } from "@lj/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bringBack, discover } from "../../services/discover";
import { nova, userWithCharacter, useTestApp } from "../../test/helpers";
import { approvedProvider, leoTrial } from "../../test/fixtures";

type Env = ReturnType<typeof useTestApp>;

async function userId(env: Env, email: string) {
  const [u] = await env.handle.db.select().from(users).where(eq(users.email, email));
  return u.id;
}

async function deedBy(env: Env, email: string, name: string, text: string, districtKey: string, note?: string) {
  const a = await userWithCharacter(env.app, email, { ...nova, name });
  const w = (await a.post("/api/me/wants").send({ text, districtKey })).body;
  const s = (await a.post("/api/first-steps").send({ executor: "self", text, wantId: w.id })).body;
  const deed = (await a.post(`/api/first-steps/${s.id}/complete`).send(note ? { noteAfter: note, noteShared: true } : {})).body.deed;
  return { agent: a, deed };
}

describe("curated discovery", () => {
  const env = useTestApp();

  it("finds related real deeds and trials for the user's wants, never the user's own", async () => {
    const mia = await deedBy(env, "mia@example.com", "Mia 的小鳥", "第一次去上聲樂試用課", "music", "大家都會破音");
    await deedBy(env, "runner@example.com", "跑跑", "第一次跑 3K", "sports");
    const leo = await approvedProvider(env);
    const { trial } = await leoTrial(env, leo);

    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    await xiaoan.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" });
    const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "在家唱給自己聽" })).body;
    await xiaoan.post(`/api/first-steps/${s.id}/complete`).send({});

    const res = await discover(env.ctx, await userId(env, "xiaoan@example.com"), {});
    expect(res.items.map((i) => i.id)).toEqual([mia.deed.id]);
    expect(res.items[0]).toMatchObject({ type: "deed", title: "第一次去上聲樂試用課", characterName: "Mia 的小鳥", executor: "self", isFirst: true, isDemo: false, placeName: "音樂坊小廣場" });
    expect(res.items[0].reasons).toContain("same_district");

    await xiaoan.post("/api/me/wants").send({ text: "想試試看跑步", districtKey: "sports" });
    const both = await discover(env.ctx, await userId(env, "xiaoan@example.com"), {});
    expect(both.items.map((i) => i.type).sort()).toEqual(["deed", "deed", "trial"]);
    expect(both.items.find((i) => i.type === "trial")).toMatchObject({ id: trial.id, title: "新手 5K 慢跑", providerName: "Leo 的新手慢跑", durationMin: 60 });
  });

  it("brings discoveries back to the user's inbox and marks them as seen", async () => {
    const mia = await deedBy(env, "mia@example.com", "Mia 的小鳥", "第一次去上聲樂試用課", "music");
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    await xiaoan.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" });
    const uid = await userId(env, "xiaoan@example.com");

    const d = await bringBack(env.ctx, uid, { message: "我在音樂坊遇到 Mia，她說第一次大家都會破音！", items: [{ type: "deed", id: mia.deed.id }] });
    expect(d.id).toBeTruthy();
    expect((await xiaoan.get("/api/me")).body.unread.discoveries).toBe(1);

    const inbox = (await xiaoan.get("/api/discoveries")).body;
    expect(inbox[0]).toMatchObject({ message: "我在音樂坊遇到 Mia，她說第一次大家都會破音！", readAt: null });
    expect(inbox[0].items).toEqual([{ type: "deed", id: mia.deed.id, title: "第一次去上聲樂試用課", districtKey: "music", isDemo: false, executor: "self", characterName: "Mia 的小鳥" }]);
    await xiaoan.post(`/api/discoveries/${inbox[0].id}/read`);
    expect((await xiaoan.get("/api/me")).body.unread.discoveries).toBe(0);

    const again = await discover(env.ctx, uid, {});
    expect(again.items[0].reasons).toContain("seen");
  });

  it("refuses to bring back items the user cannot see", async () => {
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    const other = await userWithCharacter(env.app, "o@example.com");
    const s = (await other.post("/api/first-steps").send({ executor: "self", text: "秘密" })).body;
    const priv = (await other.post(`/api/first-steps/${s.id}/complete`).send({ visibility: "private" })).body.deed;
    await expect(bringBack(env.ctx, await userId(env, "xiaoan@example.com"), { message: "看", items: [{ type: "deed", id: priv.id }] })).rejects.toThrow(/not found/);
    expect((await xiaoan.get("/api/discoveries")).body).toEqual([]);
  });

  it("ranks real content before demo content", async () => {
    const demo = await deedBy(env, "demo@example.com", "示範角色", "第一次在別人面前唱歌", "music");
    await env.handle.db.update(users).set({ isDemo: true }).where(eq(users.email, "demo@example.com"));
    const { deeds } = await import("@lj/db");
    await env.handle.db.update(deeds).set({ isDemo: true }).where(eq(deeds.id, demo.deed.id));
    const real = await deedBy(env, "real@example.com", "真人", "唱了一首歌", "music");
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    await xiaoan.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" });
    const res = await discover(env.ctx, await userId(env, "xiaoan@example.com"), {});
    expect(res.items.map((i) => i.id)).toEqual([real.deed.id, demo.deed.id]);
    expect(res.items[1].isDemo).toBe(true);
  });
});

describe("mirror", () => {
  const env = useTestApp();

  it("shows footprints, overlap between wants and deeds, before/after notes side by side, and thanks received", async () => {
    const mia = await deedBy(env, "mia@example.com", "Mia 的小鳥", "先問清楚試用課會做什麼", "music");
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    const w = (await xiaoan.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" })).body;
    await xiaoan.post("/api/me/wants").send({ text: "想試試看跑步", districtKey: "sports" });
    const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "去上聲樂試用課", wantId: w.id, sourceDeedIds: [mia.deed.id], noteBefore: "萬一破音怎麼辦" })).body;
    await xiaoan.post(`/api/first-steps/${s.id}/complete`).send({ noteAfter: "根本沒人在看我" });

    const m = (await xiaoan.get("/api/mirror")).body;
    expect(m.footprints).toEqual([{ placeId: "pub_music", placeName: "音樂坊小廣場", districtKey: "music", firstAt: expect.any(String), count: 1 }]);
    expect(m.overlap).toEqual([
      { want: { id: w.id, text: "想在別人面前唱一首歌", districtKey: "music" }, deeds: [{ id: expect.any(String), title: "去上聲樂試用課", executor: "self" }] },
      { want: { id: expect.any(String), text: "想試試看跑步", districtKey: "sports" }, deeds: [] },
    ]);
    expect(m.notePairs).toEqual([{ stepId: s.id, text: "去上聲樂試用課", before: "萬一破音怎麼辦", after: "根本沒人在看我", doneAt: expect.any(String) }]);
    expect(m.stats).toMatchObject({ deeds: 1, byExecutor: { ai: 0, self: 1 }, followed: { referenced: 0, completed: 0 } });

    const miaMirror = (await mia.agent.get("/api/mirror")).body;
    expect(miaMirror.stats.followed).toEqual({ referenced: 1, completed: 1 });
  });
});
