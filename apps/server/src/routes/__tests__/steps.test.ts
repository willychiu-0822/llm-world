import { describe, expect, it } from "vitest";
import { nova, userWithCharacter, useTestApp } from "../../test/helpers";

const mia = { ...nova, name: "Mia 的小鳥", appearance: { ...nova.appearance, accessory: "flower" } };

async function setup(env: ReturnType<typeof useTestApp>) {
  const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
  const want = (await xiaoan.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" })).body;
  return { xiaoan, want };
}

describe("first steps and deeds", () => {
  const env = useTestApp();

  it("defines a self step with a before-note and completes it into a public deed", async () => {
    const { xiaoan, want } = await setup(env);
    const created = await xiaoan.post("/api/first-steps").send({
      executor: "self",
      text: "在家人面前唱一首歌",
      wantId: want.id,
      noteBefore: "應該會很尷尬吧",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "confirmed", executor: "self", proposedBy: "user" });

    const list = await xiaoan.get("/api/first-steps?status=confirmed");
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([created.body.id]);
    expect(list.body[0].notes.before).toMatchObject({ body: "應該會很尷尬吧", shared: false });

    const done = await xiaoan.post(`/api/first-steps/${created.body.id}/complete`).send({ noteAfter: "其實大家都在拍手", noteShared: true, visibility: "public" });
    expect(done.status).toBe(200);
    expect(done.body.deed).toMatchObject({ executor: "self", districtKey: "music", placeId: "pub_music", recordSource: "self", isFirst: true, visibility: "public" });

    const other = await userWithCharacter(env.app, "other@example.com", mia);
    const view = await other.get(`/api/deeds/${done.body.deed.id}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ title: "在家人面前唱一首歌", executor: "self", character: { name: "Nova" }, isMine: false, isDemo: false });
    expect(view.body.sharedNotes).toEqual({ after: "其實大家都在拍手" });
    expect(JSON.stringify(view.body)).not.toContain("xiaoan@example.com");
  });

  it("keeps private deeds hidden from others and lets the owner change visibility", async () => {
    const { xiaoan } = await setup(env);
    const step = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "傳訊息給老朋友" })).body;
    const deed = (await xiaoan.post(`/api/first-steps/${step.id}/complete`).send({ visibility: "private" })).body.deed;
    expect(deed.districtKey).toBe("misc");
    const other = await userWithCharacter(env.app, "o@example.com", mia);
    expect((await other.get(`/api/deeds/${deed.id}`)).status).toBe(404);
    expect((await xiaoan.get(`/api/deeds/${deed.id}`)).body.isMine).toBe(true);
    expect((await xiaoan.patch(`/api/deeds/${deed.id}`).send({ visibility: "public" })).status).toBe(200);
    expect((await other.get(`/api/deeds/${deed.id}`)).status).toBe(200);
    expect((await other.patch(`/api/deeds/${deed.id}`).send({ visibility: "private" })).status).toBe(404);
  });

  it("marks only the first deed in a district as a first time", async () => {
    const { xiaoan, want } = await setup(env);
    const ids = [];
    for (const text of ["第一次唱", "第二次唱"]) {
      const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text, wantId: want.id })).body;
      ids.push((await xiaoan.post(`/api/first-steps/${s.id}/complete`).send({})).body.deed);
    }
    expect(ids.map((d) => d.isFirst)).toEqual([true, false]);
  });

  it("thanks the source deed's owner when someone references and then completes it", async () => {
    const miaAgent = await userWithCharacter(env.app, "mia@example.com", mia);
    const s = (await miaAgent.post("/api/first-steps").send({ executor: "self", text: "先問清楚試用課會做什麼" })).body;
    const source = (await miaAgent.post(`/api/first-steps/${s.id}/complete`).send({})).body.deed;

    const { xiaoan } = await setup(env);
    const step = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "我也先問清楚", sourceDeedIds: [source.id] })).body;
    let notes = (await miaAgent.get("/api/notifications")).body;
    expect(notes.map((n: { kind: string }) => n.kind)).toEqual(["followed_referenced"]);
    expect(notes[0].payload).toMatchObject({ deedId: source.id, deedTitle: "先問清楚試用課會做什麼" });
    expect(JSON.stringify(notes)).not.toContain("xiaoan");

    const done = (await xiaoan.post(`/api/first-steps/${step.id}/complete`).send({})).body.deed;
    expect(done.relatedDeedIds).toEqual([source.id]);
    notes = (await miaAgent.get("/api/notifications")).body;
    expect(notes.map((n: { kind: string }) => n.kind)).toEqual(["followed_completed", "followed_referenced"]);
    expect((await miaAgent.get("/api/me")).body.unread.notifications).toBe(2);
    await miaAgent.post("/api/notifications/read-all");
    expect((await miaAgent.get("/api/me")).body.unread.notifications).toBe(0);

    const ownerView = (await miaAgent.get(`/api/deeds/${source.id}`)).body;
    expect(ownerView.followers).toEqual({ referenced: 1, completed: 1 });
    expect((await xiaoan.get(`/api/deeds/${source.id}`)).body.followers).toBeUndefined();
  });

  it("rejects referencing one's own or a private deed", async () => {
    const { xiaoan } = await setup(env);
    const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "自己的事" })).body;
    const own = (await xiaoan.post(`/api/first-steps/${s.id}/complete`).send({ visibility: "private" })).body.deed;
    expect((await xiaoan.post("/api/first-steps").send({ executor: "self", text: "x", sourceDeedIds: [own.id] })).status).toBe(400);
    const other = await userWithCharacter(env.app, "o2@example.com", mia);
    expect((await other.post("/api/first-steps").send({ executor: "self", text: "x", sourceDeedIds: [own.id] })).status).toBe(400);
  });

  it("does not let the web complete an AI step and lets the user drop steps", async () => {
    const { xiaoan } = await setup(env);
    const ai = (await xiaoan.post("/api/first-steps").send({ executor: "ai", text: "Nova，幫我問老師試用課的流程" })).body;
    expect(ai.status).toBe("confirmed");
    expect((await xiaoan.post(`/api/first-steps/${ai.id}/complete`).send({})).status).toBe(409);
    expect((await xiaoan.post(`/api/first-steps/${ai.id}/drop`)).body.status).toBe("dropped");
  });

  it("edits before/after notes and their sharing", async () => {
    const { xiaoan } = await setup(env);
    const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "去唱 KTV" })).body;
    await xiaoan.put(`/api/first-steps/${s.id}/notes/before`).send({ body: "好緊張", shared: true });
    const deed = (await xiaoan.post(`/api/first-steps/${s.id}/complete`).send({ noteAfter: "好好玩" })).body.deed;
    const other = await userWithCharacter(env.app, "o3@example.com", mia);
    expect((await other.get(`/api/deeds/${deed.id}`)).body.sharedNotes).toEqual({ before: "好緊張" });
    await xiaoan.put(`/api/first-steps/${s.id}/notes/after`).send({ body: "好好玩！", shared: true });
    expect((await other.get(`/api/deeds/${deed.id}`)).body.sharedNotes).toEqual({ before: "好緊張", after: "好好玩！" });
    expect((await xiaoan.put(`/api/first-steps/${s.id}/notes/middle`).send({ body: "x" })).status).toBe(400);
  });

  it("downloads a calendar file for a planned step", async () => {
    const { xiaoan } = await setup(env);
    const s = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "去聽 open mic", plannedAt: "2026-11-07T10:00:00+08:00", where: "音樂坊" })).body;
    const ics = await xiaoan.get(`/api/first-steps/${s.id}/ics`);
    expect(ics.status).toBe(200);
    expect(ics.headers["content-type"]).toContain("text/calendar");
    expect(ics.text).toContain("DTSTART:20261107T020000Z");
    expect(ics.text).toContain("SUMMARY:去聽 open mic");
  });

  it("suggests predecessors' first steps for a deed", async () => {
    const miaAgent = await userWithCharacter(env.app, "mia@example.com", mia);
    const s = (await miaAgent.post("/api/first-steps").send({ executor: "ai", text: "請角色先問清楚流程" })).body;
    await miaAgent.post(`/api/first-steps/${s.id}/drop`);
    const s2 = (await miaAgent.post("/api/first-steps").send({ executor: "self", text: "去上一次聲樂試用課" })).body;
    const deed = (await miaAgent.post(`/api/first-steps/${s2.id}/complete`).send({})).body.deed;
    const { xiaoan } = await setup(env);
    const sug = await xiaoan.get(`/api/first-steps/suggestions?deedId=${deed.id}`);
    expect(sug.status).toBe(200);
    expect(sug.body.predecessors[0]).toMatchObject({ deedId: deed.id, text: "去上一次聲樂試用課", executor: "self", characterName: "Mia 的小鳥" });
  });
});

describe("first steps with blocking moderation", () => {
  const env = useTestApp({ moderationMode: "block" });
  it("refuses a step whose text is blocked", async () => {
    const agent = await userWithCharacter(env.app, "x@example.com");
    const res = await agent.post("/api/first-steps").send({ executor: "self", text: "去死啦" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("moderation_blocked");
  });
});
