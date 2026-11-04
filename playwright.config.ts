import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8181);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "zh-TW", timezoneId: "Asia/Taipei" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_e2e",
      AUTH_DEV_LOGIN: "true",
      ADMIN_EMAILS: "admin@e2e.test",
      SESSION_SECRET: "e2e-session-secret-e2e-session-secret",
      MODERATION_MODE: "filter",
      MCP_RATE_LIMIT_PER_MINUTE: "1000",
    },
  },
});
