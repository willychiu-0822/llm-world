import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, request, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { mkdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

export const BASE = `http://localhost:${process.env.E2E_PORT ?? 4131}`;
// Tests run serially. Isolate every scenario, including the second viewport run.
test.afterEach(async ({ browser }) => {
  for (const [i, ctx] of browser.contexts().entries()) {
    for (const [j, page] of ctx.pages().entries()) {
      if (!page.isClosed()) await evidence(page, `${test.info().file.split("/").pop()?.replace(".spec.ts", "")}-${i}-${j}`);
    }
  }
});

test.beforeEach(async () => {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/longjiao_laned_e2e";
  if (new URL(url).pathname !== "/longjiao_laned_e2e") throw new Error("Only the session D E2E database may be reset");
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try { await db.query("DELETE FROM users"); } finally { await db.end(); }
});

export async function evidence(page: Page, name: string) {
  await mkdir("docs/uat/evidence", { recursive: true });
  await page.screenshot({ path: `docs/uat/evidence/${test.info().project.name}-${name}.png`, fullPage: true });
}

// Nothing listens here; the consent redirect is captured before the browser follows it.
const REDIRECT = "http://localhost:47901/callback";

/** Logs in through the real login page (dev login is enabled only outside production). */
export async function loginPage(browser: Browser, email: string, name: string): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: test.info().project.use.viewport, isMobile: test.info().project.use.isMobile, hasTouch: test.info().project.use.hasTouch });
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("名字").fill(name);
  await page.getByRole("button", { name: "開發用登入" }).click();
  await page.waitForURL(`${BASE}/`);
  return page;
}

export async function apiAs(email: string, name = email.split("@")[0]): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: BASE });
  const r = await api.post("/api/auth/dev-login", { data: { email, name } });
  expect(r.ok()).toBeTruthy();
  return api;
}

export async function json<T = any>(p: Promise<import("@playwright/test").APIResponse>): Promise<T> {
  const r = await p;
  if (!r.ok()) throw new Error(`${r.status()} ${r.url()} ${await r.text()}`);
  return (r.status() === 204 ? null : await r.json()) as T;
}

export const look = (accessory = "dragon_horns") => ({ body: "round", accessory, main: "#F2C6A8", accent: "#A9C7DE", description: "" });

export async function approvedProvider(email: string, name: string, shop: { districtKey: string; name: string; realAddress: string }, trial: Record<string, unknown>, faqs: { question: string; answer: string }[], startsAt: string) {
  const p = await apiAs(email);
  const applied = await json(p.post("/api/provider/apply", { data: { name } }));
  const admin = await apiAs("admin@e2e.test");
  await json(admin.post(`/api/admin/providers/${applied.id}/approve`));
  const s = await json(p.post("/api/provider/shops", { data: shop }));
  const t = await json(p.post("/api/provider/trials", { data: { placeId: s.id, durationMin: 60, exitAnytime: true, buddyOk: true, ...trial } }));
  for (const f of faqs) await json(p.post(`/api/provider/trials/${t.id}/faqs`, { data: f }));
  const session = await json(p.post(`/api/provider/trials/${t.id}/sessions`, { data: { startsAt, capacity: 10 } }));
  return { api: p, shop: s, trial: t, session };
}

/** Full OAuth 2.1 + PKCE flow, approving on the real consent page in the user's browser. */
export async function mcpConnect(page: Page): Promise<Client> {
  const reg = await json(page.request.post("/register", { data: { redirect_uris: [REDIRECT], client_name: "E2E 測試 AI", token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] } }));
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  // Playwright does not route redirect follow-ups, so capture the consent POST's redirect instead.
  let callback = "";
  await page.route("**/oauth/consent", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const res = await route.fetch({ maxRedirects: 0 });
    callback = res.headers()["location"] ?? "";
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>已連接，可以關閉這個頁面。</p>" });
  });
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "e2e", scope: "world" });
  await page.goto(`/authorize?${q}`);
  await expect(page.getByText("E2E 測試 AI")).toBeVisible();
  await page.getByRole("button", { name: "同意連接" }).click();
  await expect.poll(() => callback).toContain("code=");
  expect(callback.startsWith(REDIRECT)).toBe(true);
  expect(new URL(callback).searchParams.get("state")).toBe("e2e");
  const code = new URL(callback).searchParams.get("code")!;
  const token = await json(page.request.post("/token", { form: { grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: REDIRECT } }));
  await page.unroute("**/oauth/consent");
  const client = new Client({ name: "e2e-ai", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } } }));
  return client;
}

export async function tool<T = any>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  if (res.isError) throw new Error(`${name} failed: ${res.content[0]?.text}`);
  return JSON.parse(res.content[0].text) as T;
}

export async function seedPredecessor() {
  const mia = await apiAs("novice-mia@e2e.test", "Mia");
  await json(mia.put("/api/me/character", { data: { name: "Mia 的小鳥", appearance: look("flower"), personality: "害羞", sharing: { allowAiQuotes: true } } }));
  const want = await json(mia.post("/api/me/wants", { data: { text: "想唱歌", districtKey: "music" } }));
  const step = await json(mia.post("/api/first-steps", { data: { executor: "self", text: "去上一次聲樂試用課，先聽老師唱一首歌", wantId: want.id } }));
  const { deed } = await json(mia.post(`/api/first-steps/${step.id}/complete`, { data: { noteAfter: "第一次只聽也可以", noteShared: true } }));
  await mia.dispose();
  return deed;
}

/** Drag the cropped mobile map, exactly as a person would, before clicking a building. */
export async function panToPlace(page: Page, name: RegExp) {
  const map = page.locator(".town-svg");
  await map.scrollIntoViewIfNeeded();
  const target = page.getByRole("link", { name });
  for (let i = 0; i < 5; i++) {
    const m = await map.boundingBox();
    const t = await target.boundingBox();
    if (!m || !t) throw new Error("Map or place is missing");
    const center = t.x + t.width / 2;
    if (center > m.x + 25 && center < m.x + m.width - 25) return;
    const direction = center < m.x + m.width / 2 ? 1 : -1;
    await page.mouse.move(m.x + m.width / 2 - direction * 80, m.y + m.height / 2);
    await page.mouse.down();
    await page.mouse.move(m.x + m.width / 2 + direction * 80, m.y + m.height / 2, { steps: 10 });
    await page.mouse.up();
  }
}
