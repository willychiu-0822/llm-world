import { describe, expect, it } from "vitest";
import { login, nova, useTestApp } from "../../test/helpers";

describe("character and wants", () => {
  const env = useTestApp();

  it("creates and updates the character", async () => {
    const agent = await login(env.app, "xiaoan@example.com");
    const created = await agent.put("/api/me/character").send(nova);
    expect(created.status).toBe(200);
    expect(created.body.character).toMatchObject({ name: "Nova", personality: "外向、喜歡站上舞台", sharing: { allowAiQuotes: true } });
    const updated = await agent.put("/api/me/character").send({ ...nova, name: "Nova II" });
    expect(updated.body.character.name).toBe("Nova II");
    expect(updated.body.character.id).toBe(created.body.character.id);
  });

  it("validates the character", async () => {
    const agent = await login(env.app, "bad@example.com");
    const res = await agent.put("/api/me/character").send({ ...nova, appearance: { ...nova.appearance, body: "dragon" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_input");
    expect((await agent.put("/api/me/character").send({ ...nova, name: "" })).status).toBe(400);
  });

  it("masks blocked words in public character fields (filter mode)", async () => {
    const agent = await login(env.app, "rude@example.com");
    const res = await agent.put("/api/me/character").send({ ...nova, personality: "我是 fuck 大王" });
    expect(res.body.character.personality).toBe("我是 **** 大王");
  });

  it("adds, edits and drops wants", async () => {
    const agent = await login(env.app, "w@example.com");
    const a = await agent.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" });
    expect(a.status).toBe(201);
    await agent.post("/api/me/wants").send({ text: "想試試看跑步", districtKey: "sports" });
    let me = (await agent.get("/api/me")).body;
    expect(me.wants.map((w: { text: string }) => w.text)).toEqual(["想在別人面前唱一首歌", "想試試看跑步"]);
    const edited = await agent.patch(`/api/me/wants/${a.body.id}`).send({ text: "想找人一起練唱", status: "active" });
    expect(edited.body.text).toBe("想找人一起練唱");
    await agent.patch(`/api/me/wants/${a.body.id}`).send({ status: "dropped" });
    me = (await agent.get("/api/me")).body;
    expect(me.wants).toHaveLength(1);
  });

  it("rejects unknown districts and other users' wants", async () => {
    const a = await login(env.app, "a@example.com");
    const b = await login(env.app, "b@example.com");
    expect((await a.post("/api/me/wants").send({ text: "x", districtKey: "space" })).status).toBe(400);
    const w = await a.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" });
    expect((await b.patch(`/api/me/wants/${w.body.id}`).send({ status: "dropped" })).status).toBe(404);
  });
});
