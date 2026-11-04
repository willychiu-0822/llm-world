import request from "supertest";
import { describe, expect, it } from "vitest";
import { login, useTestApp } from "../test/helpers";

describe("auth", () => {
  const env = useTestApp();

  it("rejects /api/me without a session", async () => {
    const res = await request(env.app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("dev login creates a user and a session", async () => {
    const agent = await login(env.app, "xiaoan@example.com", "小安");
    const res = await agent.get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "xiaoan@example.com", displayName: "小安", roles: ["user"] });
    expect(res.body.character).toBeNull();
    expect(res.body.wants).toEqual([]);
    expect(res.body.unread).toEqual({ notifications: 0, discoveries: 0 });
  });

  it("logging in twice reuses the same user", async () => {
    const a = await login(env.app, "same@example.com");
    const b = await login(env.app, "SAME@example.com");
    const ida = (await a.get("/api/me")).body.user.id;
    const idb = (await b.get("/api/me")).body.user.id;
    expect(ida).toBe(idb);
  });

  it("gives the admin role to ADMIN_EMAILS", async () => {
    const agent = await login(env.app, "admin@example.com");
    expect((await agent.get("/api/me")).body.user.roles).toEqual(["user", "admin"]);
  });

  it("logout ends the session", async () => {
    const agent = await login(env.app, "bye@example.com");
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  it("deleting the account removes the user", async () => {
    const agent = await login(env.app, "gone@example.com");
    expect((await agent.delete("/api/me")).status).toBe(204);
    expect((await agent.get("/api/me")).status).toBe(401);
    const again = await login(env.app, "gone@example.com");
    expect((await again.get("/api/me")).body.character).toBeNull();
  });

  it("google start redirects to Google with state", async () => {
    const res = await request(env.app).get("/auth/google/start?next=/town");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.location).toContain("redirect_uri=" + encodeURIComponent("http://localhost:8080/auth/google/callback"));
    expect(String(res.headers["set-cookie"])).toContain("lj_oauth_state=");
  });

  it("google callback signs in through the injected verifier and redirects to next", async () => {
    env.ctx.google.exchange = async (code) => ({ sub: "g-123", email: "mia@example.com", name: code === "ok" ? "Mia" : "?" });
    const agent = request.agent(env.app);
    const start = await agent.get("/auth/google/start?next=/me");
    const state = new URL(start.headers.location).searchParams.get("state");
    const cb = await agent.get(`/auth/google/callback?code=ok&state=${state}`);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("/me");
    const me = await agent.get("/api/me");
    expect(me.body.user).toMatchObject({ email: "mia@example.com", displayName: "Mia" });
  });

  it("google callback rejects a wrong state", async () => {
    const agent = request.agent(env.app);
    await agent.get("/auth/google/start");
    const cb = await agent.get(`/auth/google/callback?code=ok&state=wrong`);
    expect(cb.status).toBe(400);
  });

  it("only allows relative next paths", async () => {
    env.ctx.google.exchange = async () => ({ sub: "g-9", email: "x@example.com", name: "X" });
    const agent = request.agent(env.app);
    const start = await agent.get("/auth/google/start?next=https://evil.example.com");
    const state = new URL(start.headers.location).searchParams.get("state");
    const cb = await agent.get(`/auth/google/callback?code=ok&state=${state}`);
    expect(cb.headers.location).toBe("/");
  });
});

describe("auth without dev login", () => {
  const env = useTestApp({ devLogin: false });
  it("hides the dev login endpoint", async () => {
    const res = await request(env.app).post("/api/auth/dev-login").send({ email: "a@example.com" });
    expect(res.status).toBe(404);
  });
});
