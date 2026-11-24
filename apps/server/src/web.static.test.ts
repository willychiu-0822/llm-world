import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { login, useTestApp } from "./test/helpers";

const dist = mkdtempSync(path.join(tmpdir(), "lj-web-"));
mkdirSync(path.join(dist, "assets"));
writeFileSync(path.join(dist, "assets", "life.js"), "export default 1\n");
writeFileSync(path.join(dist, "index.html"), "<div id=\"root\"></div>");

describe("static assets", () => {
  const env = useTestApp({ webDist: dist });

  it("生活頁的腳本不會等資料庫連線，連線被占滿時仍立刻回檔", async () => {
    const agent = await login(env.app, "asset@example.com");
    const held = [];
    for (let i = 0; i < 4; i++) held.push(await env.handle.pool.connect());
    const pending = agent.get("/assets/life.js");
    try {
      const result = await Promise.race([
        pending.then((res) => ({ served: true as const, status: res.status, text: res.text })),
        new Promise<{ served: false }>((resolve) => setTimeout(() => resolve({ served: false }), 1000)),
      ]);
      expect(result.served, "asset request waited on the database pool").toBe(true);
      if (result.served) {
        expect(result.status).toBe(200);
        expect(result.text).toContain("export default 1");
      }
    } finally {
      for (const client of held) client.release();
      await pending;
    }
  });
});
