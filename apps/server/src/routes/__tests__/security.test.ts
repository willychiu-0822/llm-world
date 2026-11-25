import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../config";
import { CONSENT_STYLE_HASH } from "../../http/csp";
import { REST_WRITE_LIMIT_MESSAGE } from "../../http/write-limit";
import { login, nova, useTestApp } from "../../test/helpers";

const dist = mkdtempSync(path.join(tmpdir(), "lj-csp-"));
mkdirSync(path.join(dist, "assets"));
writeFileSync(
  path.join(dist, "index.html"),
  "<!doctype html><title>龍角鎮</title><div id=root></div>",
);

describe("content security policy", () => {
  const env = useTestApp({ webDist: dist });

  it("sends a strict same-origin policy on documents and API responses", async () => {
    const page = await request(env.app).get("/");
    const api = await request(env.app).get("/api/config");
    for (const res of [page, api]) {
      const csp = String(res.headers["content-security-policy"]);
      expect(res.status).toBe(200);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("script-src-attr 'none'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("img-src 'self' data:");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain(`style-src 'self' ${CONSENT_STYLE_HASH}`);
      expect(csp).toContain("style-src-attr 'unsafe-inline'");
      expect(csp.split(";").find((part) => part.trim().startsWith("style-src "))).not.toContain(
        "unsafe-inline",
      );
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
      expect(csp).not.toContain("upgrade-insecure-requests");
      expect(csp).not.toContain("https:");
    }
  });
});

describe("REST write limit config", () => {
  it("defaults to 120 per minute and rejects a non-positive value", () => {
    expect(loadConfig({ NODE_ENV: "test" }).restWriteRateLimitPerMinute).toBe(120);
    expect(
      loadConfig({ NODE_ENV: "test", REST_WRITE_RATE_LIMIT_PER_MINUTE: "80" })
        .restWriteRateLimitPerMinute,
    ).toBe(80);
    expect(() => loadConfig({ NODE_ENV: "test", REST_WRITE_RATE_LIMIT_PER_MINUTE: "0" })).toThrow(
      /REST_WRITE_RATE_LIMIT_PER_MINUTE/,
    );
  });
});

describe("REST write rate limit", () => {
  const env = useTestApp({ restWriteRateLimitPerMinute: 3 });

  it("returns 429 for a burst from one account, and still serves reads and another account", async () => {
    const a = await login(env.app, "burst@example.com", "小安");
    const wrote = [];
    for (let i = 0; i < 3; i++) wrote.push(await a.put("/api/me/character").send(nova));
    expect(wrote.map((r) => r.status)).toEqual([200, 200, 200]);

    const blocked = await a.put("/api/me/character").send(nova);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: { code: "rate_limited", message: REST_WRITE_LIMIT_MESSAGE },
    });

    for (let i = 0; i < 10; i++) expect((await a.get("/api/me")).status).toBe(200);

    const b = await login(env.app, "other@example.com", "小白");
    expect((await b.put("/api/me/character").send(nova)).status).toBe(200);
  });

  it("falls back to the client IP for anonymous writes", async () => {
    const send = (ip: string, n: number) =>
      request(env.app)
        .post("/api/auth/dev-login")
        .set("X-Forwarded-For", ip)
        .send({ email: `${ip}-${n}@example.com` });
    expect((await send("203.0.113.10", 1)).status).toBe(200);
    expect((await send("203.0.113.10", 2)).status).toBe(200);
    expect((await send("203.0.113.10", 3)).status).toBe(200);
    const blocked = await send("203.0.113.10", 4);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toEqual({ code: "rate_limited", message: REST_WRITE_LIMIT_MESSAGE });
    expect((await send("203.0.113.11", 1)).status).toBe(200);
  });
});

describe("OAuth sign-in has its own write budget", () => {
  const env = useTestApp({ restWriteRateLimitPerMinute: 2 });

  it("still accepts sign-in POSTs after ordinary writes are used up", async () => {
    const ip = "198.51.100.20";
    const write = (n: number) =>
      request(env.app)
        .post("/api/auth/dev-login")
        .set("X-Forwarded-For", ip)
        .send({ email: `writes-${n}@example.com`, name: "小安" });
    const token = () =>
      request(env.app)
        .post("/token")
        .set("X-Forwarded-For", ip)
        .type("form")
        .send({ grant_type: "authorization_code" });

    expect((await write(1)).status).toBe(200);
    expect((await token()).status).not.toBe(429);
    expect((await write(2)).status).toBe(200);
    const blockedWrite = await write(3);
    expect(blockedWrite.status).toBe(429);
    expect(blockedWrite.body.error).toEqual({
      code: "rate_limited",
      message: REST_WRITE_LIMIT_MESSAGE,
    });

    const callback = await token();
    expect(callback.status).not.toBe(429);
    const blockedSignIn = await token();
    expect(blockedSignIn.status).toBe(429);
    expect(blockedSignIn.body.error).toEqual({
      code: "rate_limited",
      message: REST_WRITE_LIMIT_MESSAGE,
    });

    const user = await login(env.app, "signer@example.com", "小安");
    expect((await user.put("/api/me/character").send(nova)).status).toBe(200);
    expect((await user.put("/api/me/character").send(nova)).status).toBe(200);
    expect((await user.put("/api/me/character").send(nova)).status).toBe(429);
    const consent = await user.post("/oauth/consent").type("form").send({ decision: "deny" });
    expect(consent.status).not.toBe(429);
  });
});

describe("MCP stays on its own limiter", () => {
  const env = useTestApp({ restWriteRateLimitPerMinute: 1 });

  it("does not count POST /mcp toward the REST write limit", async () => {
    const first = await request(env.app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const second = await request(env.app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });
});

describe("ordinary use under the default write limit", () => {
  const env = useTestApp();

  it("lets a normal session write a few times and read freely", async () => {
    const agent = await login(env.app, "calm@example.com", "小安");
    expect((await agent.put("/api/me/character").send(nova)).status).toBe(200);
    expect(
      (await agent.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" })).status,
    ).toBe(201);
    expect((await agent.get("/api/me")).status).toBe(200);
    for (let i = 0; i < 30; i++) expect((await agent.get("/api/town")).status).toBe(200);
  });
});
