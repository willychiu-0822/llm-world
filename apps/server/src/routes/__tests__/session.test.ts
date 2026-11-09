import request from "supertest";
import { describe, expect, it } from "vitest";
import { login, useTestApp } from "../../test/helpers";

describe("P2-2 optional session probe", () => {
  const env = useTestApp();
  it("returns an anonymous 200 without opening protected writes", async () => {
    const res = await request(env.app).get("/api/session");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ me: null });
    expect(res.headers["cache-control"]).toContain("no-store");
    expect((await request(env.app).put("/api/me/character").send({ name: "x" })).status).toBe(401);
  });
  it("returns the same signed-in identity as the protected endpoint, then null after logout", async () => {
    const agent = await login(env.app, "session@example.com");
    expect((await agent.get("/api/session")).body).toEqual({ me: (await agent.get("/api/me")).body });
    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/session")).body).toEqual({ me: null });
  });
  it("treats an unknown session cookie as an anonymous visit", async () => {
    const res = await request(env.app).get("/api/session").set("Cookie", "lj_sid=expired-test-session");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ me: null });
  });
});
