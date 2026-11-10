import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import http from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approvedProvider, leoTrial } from "../test/fixtures";
import { login, nova, userWithCharacter, useTestApp } from "../test/helpers";

type Agent = Awaited<ReturnType<typeof login>>;

const REDIRECT = "http://localhost:9999/callback";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClient(env: ReturnType<typeof useTestApp>) {
  const res = await request(env.app)
    .post("/register")
    .send({ redirect_uris: [REDIRECT], client_name: "Test AI", token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  expect(res.status).toBe(201);
  return res.body.client_id as string;
}

async function authorize(env: ReturnType<typeof useTestApp>, agent: Agent, clientId: string, decision: "approve" | "deny" = "approve") {
  const { verifier, challenge } = pkce();
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "st-1",
    scope: "world",
    resource: "http://localhost:8080/mcp",
  });
  const start = await agent.get(`/authorize?${q}`);
  expect(start.status).toBe(302);
  const consentUrl = start.headers.location as string;
  expect(consentUrl).toMatch(/^\/oauth\/consent\?req=/);
  const page = await agent.get(consentUrl);
  expect(page.status).toBe(200);
  expect(page.text).toContain("Test AI");
  const csrf = /name="csrf" value="([^"]+)"/.exec(page.text)![1];
  const req = new URL(consentUrl, "http://x").searchParams.get("req")!;
  const done = await agent.post("/oauth/consent").type("form").send({ req, csrf, decision });
  expect(done.status).toBe(302);
  return { location: new URL(done.headers.location), verifier };
}

async function tokenFor(env: ReturnType<typeof useTestApp>, agent: Agent) {
  const clientId = await registerClient(env);
  const { location, verifier } = await authorize(env, agent, clientId);
  expect(location.searchParams.get("state")).toBe("st-1");
  const res = await request(env.app)
    .post("/token")
    .type("form")
    .send({ grant_type: "authorization_code", code: location.searchParams.get("code")!, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
  expect(res.status).toBe(200);
  return { clientId, ...(res.body as { access_token: string; refresh_token: string; expires_in: number }) };
}

describe("OAuth 2.1 for MCP clients", () => {
  const env = useTestApp();

  it("publishes authorization server and protected resource metadata", async () => {
    const as = (await request(env.app).get("/.well-known/oauth-authorization-server")).body;
    expect(as).toMatchObject({ issuer: "http://localhost:8080/", authorization_endpoint: "http://localhost:8080/authorize", token_endpoint: "http://localhost:8080/token", registration_endpoint: "http://localhost:8080/register", code_challenge_methods_supported: ["S256"] });
    const pr = (await request(env.app).get("/.well-known/oauth-protected-resource/mcp")).body;
    expect(pr).toMatchObject({ resource: "http://localhost:8080/mcp", authorization_servers: ["http://localhost:8080/"] });
  });

  it("rejects MCP calls without a token and points to the metadata", async () => {
    const res = await request(env.app).post("/mcp").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("resource_metadata=");
  });

  it("sends people who are not logged in to the login page first", async () => {
    const clientId = await registerClient(env);
    const anon = request.agent(env.app);
    const { challenge } = pkce();
    const start = await anon.get(`/authorize?${new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256" })}`);
    const consent = await anon.get(start.headers.location);
    expect(consent.status).toBe(302);
    expect(consent.headers.location).toMatch(/^\/login\?next=%2Foauth%2Fconsent%3Freq%3D/);
  });

  it("returns access_denied when the person declines", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const { location } = await authorize(env, agent, await registerClient(env), "deny");
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe("st-1");
  });

  it("issues tokens, rejects code reuse, and rotates refresh tokens", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const clientId = await registerClient(env);
    const { location, verifier } = await authorize(env, agent, clientId);
    const form = { grant_type: "authorization_code", code: location.searchParams.get("code")!, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT };
    const first = await request(env.app).post("/token").type("form").send(form);
    expect(first.body).toMatchObject({ token_type: "bearer", scope: "world" });
    expect((await request(env.app).post("/token").type("form").send(form)).status).toBe(400);

    const refreshed = await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: first.body.refresh_token, client_id: clientId });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).not.toBe(first.body.access_token);
    const reuse = await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: first.body.refresh_token, client_id: clientId });
    expect(reuse.status).toBe(400);
  });

  it("rejects a wrong PKCE verifier", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const clientId = await registerClient(env);
    const { location } = await authorize(env, agent, clientId);
    const res = await request(env.app).post("/token").type("form").send({ grant_type: "authorization_code", code: location.searchParams.get("code")!, code_verifier: "x".repeat(50), client_id: clientId, redirect_uri: REDIRECT });
    expect(res.status).toBe(400);
  });
});

describe("MCP tools", () => {
  const env = useTestApp();
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer(env.app);
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => new Promise<void>((r) => server.close(() => r())));

  async function connect(token: string) {
    const client = new Client({ name: "test-ai", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    return client;
  }

  async function call<T = Record<string, unknown>>(client: Client, name: string, args: Record<string, unknown> = {}) {
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
    const text = res.content[0]?.text ?? "";
    return { isError: Boolean(res.isError), data: (res.isError ? { message: text } : JSON.parse(text)) as T };
  }

  it("lists the world tools and the character prompt", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const client = await connect((await tokenFor(env, agent)).access_token);
    const listed = (await client.listTools()).tools;
    const tools = listed.map((t) => t.name).sort();
    expect(tools).toEqual([
      "character_get",
      "deed_get",
      "discovery_bring_back",
      "first_step_complete",
      "first_step_list",
      "first_step_propose",
      "place_get",
      "provider_ask",
      "trial_get",
      "world_discover",
    ]);
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    const annotations = Object.fromEntries(listed.map((t) => [t.name, t.annotations]));
    for (const name of ["character_get", "world_discover", "place_get", "deed_get", "trial_get", "first_step_list"]) {
      expect(annotations[name], name).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
    }
    for (const name of ["discovery_bring_back", "first_step_propose", "provider_ask"]) {
      expect(annotations[name], name).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    }
    expect(annotations.first_step_complete).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(prompts).toEqual(["be_my_character"]);
    const prompt = await client.getPrompt({ name: "be_my_character" });
    expect(JSON.stringify(prompt.messages)).toContain("Nova");
    await client.close();
  });

  it("runs Xiaoan's AI loop: discover, ask, bring back, propose, and complete a confirmed AI step", async () => {
    const miaAgent = await userWithCharacter(env.app, "mia@example.com", { ...nova, name: "Mia 的小鳥" });
    const mw = (await miaAgent.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" })).body;
    const ms = (await miaAgent.post("/api/first-steps").send({ executor: "self", text: "去上一次聲樂試用課", wantId: mw.id })).body;
    const miaDeed = (await miaAgent.post(`/api/first-steps/${ms.id}/complete`).send({ noteAfter: "老師說大家第一次都會破音", noteShared: true })).body.deed;
    const leo = await approvedProvider(env);
    const { trial } = await leoTrial(env, leo);

    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    const want = (await xiaoan.post("/api/me/wants").send({ text: "想在別人面前唱一首歌", districtKey: "music" })).body;
    const client = await connect((await tokenFor(env, xiaoan)).access_token);

    const me = await call(client, "character_get");
    expect(me.data).toMatchObject({ character: { name: "Nova" }, wants: [{ id: want.id, text: "想在別人面前唱一首歌" }] });

    const found = await call<{ items: { id: string; type: string }[] }>(client, "world_discover");
    expect(found.data.items.map((i) => i.id)).toContain(miaDeed.id);

    const deed = await call(client, "deed_get", { deedId: miaDeed.id });
    expect(deed.data).toMatchObject({ title: "去上一次聲樂試用課", sharedNotes: { after: "老師說大家第一次都會破音" }, character: { name: "Mia 的小鳥" } });
    expect(JSON.stringify(deed.data)).not.toContain("mia@example.com");

    const place = await call(client, "place_get", { placeId: "pub_music" });
    expect(place.data).toMatchObject({ name: "音樂坊小廣場" });
    const town = (await request(env.app).get("/api/town")).body;
    expect(town.places.find((p: { id: string }) => p.id === "pub_music").presence.characters.map((c: { name: string }) => c.name)).toContain("Nova");

    const t = await call(client, "trial_get", { trialId: trial.id });
    expect(t.data).toMatchObject({ title: "新手 5K 慢跑", processInfo: expect.stringContaining("暖身") });

    const answered = await call(client, "provider_ask", { trialId: trial.id, question: "跟不上怎麼辦" });
    expect(answered.data).toMatchObject({ answered: true, answer: "可以走跑交替，我會陪最後一位。" });

    const back = await call(client, "discovery_bring_back", { message: "我在音樂坊遇到 Mia，她說第一次都會破音！", items: [{ type: "deed", id: miaDeed.id }] });
    expect(back.isError).toBe(false);
    expect((await xiaoan.get("/api/discoveries")).body[0].message).toContain("Mia");

    const proposed = await call<{ id: string; status: string }>(client, "first_step_propose", { executor: "ai", text: "Nova 去問老師試用課的流程", wantId: want.id, sourceDeedIds: [miaDeed.id], reason: "先知道會發生什麼" });
    expect(proposed.data.status).toBe("draft");
    expect((await xiaoan.get("/api/notifications")).body[0].kind).toBe("step_proposed");

    const early = await call(client, "first_step_complete", { stepId: proposed.data.id, result: "還沒確認就完成" });
    expect(early.isError).toBe(true);
    expect((await call<unknown[]>(client, "first_step_list")).data).toEqual([]);

    expect((await xiaoan.post(`/api/first-steps/${proposed.data.id}/confirm`)).body.status).toBe("confirmed");
    expect((await xiaoan.get("/api/notifications")).body[0]).toMatchObject({ kind: "step_proposed", payload: { handled: true, outcome: "confirmed", stepId: proposed.data.id } });
    const todo = await call<{ id: string; text: string }[]>(client, "first_step_list");
    expect(todo.data.map((s) => s.id)).toEqual([proposed.data.id]);

    const done = await call<{ status: string; result: string; stepId: string }>(client, "first_step_complete", { stepId: proposed.data.id, result: "前十分鐘練呼吸、接著唱音階、最後選一首熟悉的歌，不會要你獨唱。" });
    expect(done.data).toMatchObject({ status: "pending_review", stepId: proposed.data.id, result: expect.stringContaining("練呼吸") });
    expect(done.data).not.toHaveProperty("id");
    const waiting = (await xiaoan.get("/api/first-steps")).body.find((s: { id: string }) => s.id === proposed.data.id);
    expect(waiting).toMatchObject({ status: "review", deedId: null });
    expect((await request(env.app).get("/api/places/pub_music")).body.deeds.map((d: { title: string }) => d.title)).not.toContain("Nova 去問老師試用課的流程");
    expect((await miaAgent.get("/api/notifications")).body.map((n: { kind: string }) => n.kind)).toEqual(["followed_referenced"]);

    const published = await xiaoan.post(`/api/first-steps/${proposed.data.id}/review`).send({ decision: "approve", visibility: "public" });
    expect(published.status).toBe(200);
    expect(published.body.deed).toMatchObject({ executor: "ai", recordSource: "ai", visibility: "public", relatedDeedIds: [miaDeed.id], summary: expect.stringContaining("練呼吸") });
    const view = (await request(env.app).get(`/api/deeds/${published.body.deed.id}`)).body;
    expect(view).toMatchObject({ visibility: "public", summary: expect.stringContaining("練呼吸") });
    const miaNotes = (await miaAgent.get("/api/notifications")).body.map((n: { kind: string }) => n.kind);
    expect(miaNotes).toEqual(["followed_completed", "followed_referenced"]);
    const again = await call(client, "first_step_complete", { stepId: proposed.data.id, result: "再寫一次" });
    expect(again.isError).toBe(true);
    expect(again.data.message).toContain("step_already_done");
    expect(again.data.message).toContain("這一步已經完成了");
    await client.close();
  });

  it("keeps an AI result out of public deeds until the player edits and approves it", async () => {
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    const client = await connect((await tokenFor(env, xiaoan)).access_token);
    const proposed = await call<{ id: string }>(client, "first_step_propose", { executor: "ai", text: "先問清楚流程" });
    await xiaoan.post(`/api/first-steps/${proposed.data.id}/confirm`);
    const pending = await call<{ status: string; result: string }>(client, "first_step_complete", {
      stepId: proposed.data.id,
      result: "主人，我是小碼。問題 pq_nn3qsdsqi59autjg 先練呼吸。",
    });
    expect(pending.data).toMatchObject({ status: "pending_review", result: "我是小碼。問題先練呼吸。" });
    expect(JSON.stringify(pending.data)).not.toMatch(/主人|pq_/);
    const step = (await xiaoan.get("/api/first-steps")).body.find((s: { id: string }) => s.id === proposed.data.id);
    expect(step).toMatchObject({ status: "review", deedId: null, result: "我是小碼。問題先練呼吸。" });
    expect((await request(env.app).get("/api/places/pub_misc")).body.deeds.map((d: { summary: string }) => d.summary).join("\n")).not.toContain("先練呼吸");

    expect((await xiaoan.post(`/api/first-steps/${proposed.data.id}/review`).send({ decision: "reject" })).body.step.status).toBe("confirmed");
    expect((await xiaoan.get("/api/first-steps")).body.find((s: { id: string }) => s.id === proposed.data.id).deedId).toBeNull();
    expect((await call<{ id: string }[]>(client, "first_step_list")).data.map((s) => s.id)).toEqual([proposed.data.id]);

    await call(client, "first_step_complete", { stepId: proposed.data.id, result: "主人，第二次的結果" });
    const other = await userWithCharacter(env.app, "reader@example.com");
    const published = await xiaoan.post(`/api/first-steps/${proposed.data.id}/review`).send({ decision: "approve", visibility: "public", result: "主人，公開版 pq_nn3qsdsqi59autjg 先練呼吸" });
    expect(published.body.deed.summary).toBe("公開版先練呼吸");
    expect((await request(env.app).get(`/api/deeds/${published.body.deed.id}`)).status).toBe(200);
    expect((await other.get(`/api/deeds/${published.body.deed.id}`)).body.summary).toBe("公開版先練呼吸");
    const notice = (await xiaoan.get("/api/notifications")).body.find((n: { kind: string }) => n.kind === "ai_step_done");
    expect(notice.payload).toMatchObject({ pending: false, handled: true, outcome: "published", deedId: published.body.deed.id });
    await client.close();
  });

  it("does not let the AI complete a step meant for the person, or touch someone else's step", async () => {
    const xiaoan = await userWithCharacter(env.app, "xiaoan@example.com");
    const self = (await xiaoan.post("/api/first-steps").send({ executor: "self", text: "自己去" })).body;
    const other = await userWithCharacter(env.app, "other@example.com");
    const theirs = (await other.post("/api/first-steps").send({ executor: "ai", text: "別人的 AI 步驟" })).body;
    const client = await connect((await tokenFor(env, xiaoan)).access_token);
    expect((await call(client, "first_step_complete", { stepId: self.id, result: "x" })).isError).toBe(true);
    expect((await call(client, "first_step_complete", { stepId: theirs.id, result: "x" })).isError).toBe(true);
    await client.close();
  });

  it("hides shared notes from other people's AIs when the owner opts out", async () => {
    const owner = await userWithCharacter(env.app, "owner@example.com", { ...nova, name: "低調", sharing: { allowAiQuotes: false } });
    const s = (await owner.post("/api/first-steps").send({ executor: "self", text: "去畫畫" })).body;
    const deed = (await owner.post(`/api/first-steps/${s.id}/complete`).send({ noteAfter: "很開心", noteShared: true })).body.deed;
    const reader = await userWithCharacter(env.app, "reader@example.com");
    const client = await connect((await tokenFor(env, reader)).access_token);
    expect((await call(client, "deed_get", { deedId: deed.id })).data).toMatchObject({ sharedNotes: {} });
    expect((await reader.get(`/api/deeds/${deed.id}`)).body.sharedNotes).toEqual({ after: "很開心" });
    await client.close();
  });

  it("rejects revoked or bogus tokens", async () => {
    const res = await request(env.app).post("/mcp").set("Authorization", "Bearer nope").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
  });

  it("lists a connected AI and disconnect revokes access and refresh immediately", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const tokens = await tokenFor(env, agent);
    const client = await connect(tokens.access_token);
    await call(client, "character_get");
    await client.close();

    const listed = (await agent.get("/api/me/connections")).body as { clientId: string; name: string; connectedAt: string; lastUsedAt: string | null }[];
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ clientId: tokens.clientId, name: "Test AI" });
    expect(listed[0].connectedAt).toBeTruthy();
    expect(listed[0].lastUsedAt).toBeTruthy();

    expect((await agent.post(`/api/me/connections/${encodeURIComponent(tokens.clientId)}/disconnect`)).status).toBe(204);
    expect((await agent.get("/api/me/connections")).body).toEqual([]);
    expect((await request(env.app).post("/mcp").set("Authorization", `Bearer ${tokens.access_token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
    expect((await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: tokens.clientId })).status).toBe(400);
    expect((await agent.post(`/api/me/connections/${encodeURIComponent(tokens.clientId)}/disconnect`)).status).toBe(404);
  });

  it("revoking an access token blocks refresh, and revoking a refresh token blocks access", async () => {
    const agent = await userWithCharacter(env.app, "xiaoan@example.com");
    const first = await tokenFor(env, agent);
    expect((await request(env.app).post("/revoke").type("form").send({ token: first.access_token, client_id: first.clientId })).status).toBe(200);
    expect((await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: first.clientId })).status).toBe(400);
    expect((await request(env.app).post("/mcp").set("Authorization", `Bearer ${first.access_token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);

    const second = await tokenFor(env, agent);
    const rotated = await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: second.refresh_token, client_id: second.clientId });
    expect(rotated.status).toBe(200);
    expect((await request(env.app).post("/revoke").type("form").send({ token: rotated.body.refresh_token, client_id: second.clientId })).status).toBe(200);
    expect((await request(env.app).post("/mcp").set("Authorization", `Bearer ${rotated.body.access_token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
    expect((await request(env.app).post("/mcp").set("Authorization", `Bearer ${second.access_token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
  });

  it("deleting the account revokes its access and refresh tokens", async () => {
    const agent = await userWithCharacter(env.app, "gone@example.com");
    const tokens = await tokenFor(env, agent);
    expect((await agent.delete("/api/me")).status).toBe(204);
    expect((await request(env.app).post("/mcp").set("Authorization", `Bearer ${tokens.access_token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
    expect((await request(env.app).post("/token").type("form").send({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: tokens.clientId })).status).toBe(400);
  });
});
