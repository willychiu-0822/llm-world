import request from "supertest";
import { describe, expect, it } from "vitest";
import { askProvider } from "../../services/questions";
import { approvedProvider, leoTrial } from "../../test/fixtures";
import { login, nova, userWithCharacter, useTestApp } from "../../test/helpers";

describe("provider onboarding", () => {
  const env = useTestApp();

  it("needs admin approval before opening a shop", async () => {
    const leo = await login(env.app, "leo@example.com", "Leo");
    const applied = await leo.post("/api/provider/apply").send({ name: "Leo 的新手慢跑" });
    expect(applied.body.status).toBe("pending");
    expect((await leo.post("/api/provider/apply").send({ name: "again" })).status).toBe(409);
    expect((await leo.post("/api/provider/shops").send({ districtKey: "sports", name: "x" })).status).toBe(403);

    const someone = await login(env.app, "someone@example.com");
    expect((await someone.get("/api/admin/providers?status=pending")).status).toBe(403);
    expect((await someone.post(`/api/admin/providers/${applied.body.id}/approve`)).status).toBe(403);

    const admin = await login(env.app, "admin@example.com");
    const pending = await admin.get("/api/admin/providers?status=pending");
    expect(pending.body.map((p: { id: string }) => p.id)).toEqual([applied.body.id]);
    expect((await admin.post(`/api/admin/providers/${applied.body.id}/approve`)).body.status).toBe("approved");

    const me = (await leo.get("/api/me")).body;
    expect(me.user.roles).toContain("provider");
    expect(me.provider).toMatchObject({ status: "approved" });
    expect((await leo.get("/api/notifications")).body[0].kind).toBe("provider_approved");
  });

  it("opens a shop in a district and publishes a trial with FAQ and sessions", async () => {
    const leo = await approvedProvider(env);
    const { shop, trial, session } = await leoTrial(env, leo);
    expect(shop).toMatchObject({ kind: "shop", districtKey: "sports", slot: 1, realAddress: "台北市河濱公園入口" });
    const town = (await request(env.app).get("/api/town")).body;
    expect(town.districts).toHaveLength(9);
    expect(town.places.find((p: { id: string }) => p.id === shop.id)).toMatchObject({ name: "Leo 慢跑站", trialCount: 1, providerName: "Leo 的新手慢跑" });

    const view = (await request(env.app).get(`/api/trials/${trial.id}`)).body;
    expect(view).toMatchObject({ title: "新手 5K 慢跑", durationMin: 60, exitAnytime: true, provider: { name: "Leo 的新手慢跑" }, place: { id: shop.id, realAddress: "台北市河濱公園入口" } });
    expect(view.faqs).toEqual([{ id: expect.any(String), question: "跟不上怎麼辦？", answer: "可以走跑交替，我會陪最後一位。" }]);
    expect(view.sessions).toEqual([{ id: session.id, startsAt: expect.any(String), capacity: 2, remaining: 2 }]);

    const second = (await leo.post("/api/provider/shops").send({ districtKey: "sports", name: "第二間" })).body;
    expect(second.slot).toBe(2);
  });

  it("does not let a provider edit another provider's trial", async () => {
    const leo = await approvedProvider(env);
    const { trial } = await leoTrial(env, leo);
    const other = await approvedProvider(env, "other@example.com", "別人的教室");
    expect((await other.patch(`/api/provider/trials/${trial.id}`).send({ title: "偷改" })).status).toBe(404);
    expect((await other.post(`/api/provider/trials/${trial.id}/sessions`).send({ startsAt: "2030-11-10T07:00:00+08:00" })).status).toBe(404);
  });

  it("hides trials of suspended providers", async () => {
    const leo = await approvedProvider(env);
    const { trial } = await leoTrial(env, leo);
    const admin = await login(env.app, "admin@example.com");
    const pid = (await leo.get("/api/me")).body.provider.id;
    await admin.post(`/api/admin/providers/${pid}/suspend`);
    expect((await request(env.app).get(`/api/trials/${trial.id}`)).status).toBe(404);
  });
});

describe("bookings and attendance", () => {
  const env = useTestApp();

  it("books a session, provider confirms attendance, and the deed is provider-confirmed", async () => {
    const leo = await approvedProvider(env);
    const { shop, trial, session } = await leoTrial(env, leo);
    const runner = await userWithCharacter(env.app, "runner@example.com", { ...nova, name: "小跑" });
    const step = (await runner.post("/api/first-steps").send({ executor: "self", text: "週日去跑新手 5K", trialId: trial.id, sessionId: session.id, noteBefore: "怕跟不上" })).body;
    expect(step.sessionId).toBe(session.id);
    expect((await runner.post("/api/first-steps").send({ executor: "self", text: "again", sessionId: session.id })).status).toBe(409);

    const ics = await runner.get(`/api/first-steps/${step.id}/ics`);
    expect(ics.text).toContain("DTSTART:20301109T230000Z");
    expect(ics.text).toContain("LOCATION:台北市河濱公園入口");

    const list = (await leo.get(`/api/provider/sessions/${session.id}/bookings`)).body;
    expect(list).toEqual([{ id: expect.any(String), characterName: "小跑", attendedAt: null }]);
    expect(JSON.stringify(list)).not.toContain("runner@example.com");

    const attended = await leo.post(`/api/provider/bookings/${list[0].id}/attend`);
    expect(attended.status).toBe(200);
    const steps = (await runner.get("/api/first-steps")).body;
    expect(steps[0]).toMatchObject({ status: "done", attended: true });
    const deed = (await runner.get(`/api/deeds/${steps[0].deedId}`)).body;
    expect(deed).toMatchObject({ recordSource: "provider_confirmed", placeId: shop.id, districtKey: "sports", trial: { id: trial.id } });
    const n = (await runner.get("/api/notifications")).body;
    expect(n[0]).toMatchObject({ kind: "attendance_confirmed", payload: { stepId: step.id, deedId: deed.id, trialTitle: "新手 5K 慢跑" } });

    await runner.put(`/api/first-steps/${step.id}/notes/after`).send({ body: "比想像中輕鬆", shared: true });
    const signals = (await leo.get("/api/provider/signals")).body;
    expect(signals[0]).toMatchObject({ trialId: trial.id, bookings: 1, attended: 1, sharedNotes: [{ before: null, after: "比想像中輕鬆" }] });
  });

  it("refuses bookings over capacity", async () => {
    const leo = await approvedProvider(env);
    const { session, trial } = await leoTrial(env, leo);
    for (const e of ["a@example.com", "b@example.com"]) {
      const u = await userWithCharacter(env.app, e);
      expect((await u.post("/api/first-steps").send({ executor: "self", text: "去跑", trialId: trial.id, sessionId: session.id })).status).toBe(201);
    }
    const c = await userWithCharacter(env.app, "c@example.com");
    expect((await c.post("/api/first-steps").send({ executor: "self", text: "去跑", sessionId: session.id })).status).toBe(409);
  });
});

describe("questions from users' AIs", () => {
  const env = useTestApp();

  it("answers from the FAQ, or forwards to the provider who answers later", async () => {
    const leo = await approvedProvider(env);
    const { trial } = await leoTrial(env, leo);
    await userWithCharacter(env.app, "asker@example.com");
    const asker = (await env.handle.db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, "asker@example.com") }))!;

    const faq = await askProvider(env.ctx, asker.id, { trialId: trial.id, question: "如果我跟不上怎麼辦" });
    expect(faq).toMatchObject({ answered: true, source: "faq", answer: "可以走跑交替，我會陪最後一位。" });

    const fwd = await askProvider(env.ctx, asker.id, { trialId: trial.id, question: "需要帶水嗎？" });
    expect(fwd).toMatchObject({ answered: false });

    const qs = (await leo.get("/api/provider/questions")).body;
    expect(qs).toEqual([{ id: expect.any(String), trialId: trial.id, trialTitle: "新手 5K 慢跑", question: "需要帶水嗎？", answer: null, createdAt: expect.any(String) }]);
    expect((await leo.get("/api/notifications")).body.map((n: { kind: string }) => n.kind)).toContain("new_question");

    await leo.post(`/api/provider/questions/${qs[0].id}/answer`).send({ answer: "現場有水，帶自己的杯子就好。", addToFaq: true });
    const asked = await request(env.app).get(`/api/trials/${trial.id}`);
    expect(asked.body.faqs.map((f: { question: string }) => f.question)).toContain("需要帶水嗎？");

    const signals = (await leo.get("/api/provider/signals")).body;
    expect(signals[0]).toMatchObject({ questions: 2, recentQuestions: ["需要帶水嗎？", "如果我跟不上怎麼辦"] });
  });
});
