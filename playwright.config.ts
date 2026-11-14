import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4131);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["**/assert-e2e-database.test.mjs"],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { channel: process.env.PW_CHANNEL || undefined, baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "zh-TW", timezoneId: "Asia/Taipei" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node e2e/reset-db.mjs && pnpm --filter @lj/web build && pnpm --filter @lj/server exec tsx src/index.ts",
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    env: {
      NODE_ENV: "development",
      PORT: String(PORT),
      BASE_URL: baseURL,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/longjiao_laned_e2e",
      AUTH_DEV_LOGIN: "true",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      ADMIN_EMAILS: "admin@e2e.test",
      SESSION_SECRET: "e2e-session-secret-e2e-session-secret",
      MODERATION_MODE: "filter",
      MCP_RATE_LIMIT_PER_MINUTE: "1000",
    },
  },
});
