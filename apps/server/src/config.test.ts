import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const prod = {
  NODE_ENV: "production",
  BASE_URL: "https://longjiao.example.com",
  DATABASE_URL: "postgres://user:secret@db.internal/longjiao",
  SESSION_SECRET: "x".repeat(32),
};

describe("loadConfig production defaults", () => {
  it("forces dev login off in production even when the flag is true", () => {
    const config = loadConfig({ ...prod, AUTH_DEV_LOGIN: "true" });
    expect(config.devLogin).toBe(false);
    expect(config.isProd).toBe(true);
  });

  it("keeps dev login off unless it is explicitly enabled outside production", () => {
    expect(loadConfig({ NODE_ENV: "development" }).devLogin).toBe(false);
    expect(loadConfig({ NODE_ENV: "development", AUTH_DEV_LOGIN: "true" }).devLogin).toBe(true);
    expect(loadConfig({ NODE_ENV: "test", AUTH_DEV_LOGIN: "false" }).devLogin).toBe(false);
  });

  it("requires BASE_URL, DATABASE_URL and a 32+ character SESSION_SECRET in production", () => {
    expect(() => loadConfig({ ...prod, BASE_URL: undefined })).toThrow(/BASE_URL/);
    expect(() => loadConfig({ ...prod, DATABASE_URL: "  " })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...prod, SESSION_SECRET: "too-short" })).toThrow(/SESSION_SECRET/);
  });

  it("prefers an explicit BASE_URL over a platform hostname", () => {
    const config = loadConfig({
      ...prod,
      BASE_URL: "https://town.example.com/",
      RENDER_EXTERNAL_URL: "https://longjiao.onrender.com",
    });
    expect(config.baseUrl).toBe("https://town.example.com");
  });

  it("falls back to the platform public URL when BASE_URL is unset", () => {
    const render = loadConfig({ ...prod, BASE_URL: undefined, RENDER_EXTERNAL_URL: "https://longjiao.onrender.com/" });
    expect(render.baseUrl).toBe("https://longjiao.onrender.com");
    const railway = loadConfig({ ...prod, BASE_URL: undefined, RAILWAY_PUBLIC_DOMAIN: "longjiao.up.railway.app" });
    expect(railway.baseUrl).toBe("https://longjiao.up.railway.app");
  });
});
