import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { useTestApp } from "../../test/helpers";

const dist = mkdtempSync(path.join(tmpdir(), "lj-web-"));
mkdirSync(path.join(dist, "assets"));
writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>龍角鎮</title><div id=root></div>");
writeFileSync(path.join(dist, "assets", "app.js"), "console.log('hi')");

describe("public config and web app serving", () => {
  const env = useTestApp({ webDist: dist });

  it("exposes public config", async () => {
    const res = await request(env.app).get("/api/config");
    expect(res.body).toEqual({ appName: "龍角鎮", devLogin: true, googleLogin: false, mcpUrl: "http://localhost:8080/mcp" });
  });

  it("serves static assets and falls back to index.html for app routes", async () => {
    expect((await request(env.app).get("/assets/app.js")).text).toContain("hi");
    const page = await request(env.app).get("/places/pub_music");
    expect(page.status).toBe(200);
    expect(page.text).toContain("龍角鎮");
    expect(page.headers["cache-control"]).toContain("no-cache");
  });

  it("does not swallow API, OAuth or MCP routes", async () => {
    expect((await request(env.app).get("/api/nope")).status).toBe(404);
    expect((await request(env.app).get("/.well-known/oauth-authorization-server")).body.issuer).toBeTruthy();
    expect((await request(env.app).get("/healthz")).body).toEqual({ ok: true });
  });
});
