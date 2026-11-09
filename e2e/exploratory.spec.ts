import { expect } from "@playwright/test";
import { test, evidence, json, look, seedPredecessor } from "./helpers";

test("UAT-15 訪客從事蹟登入後回到原第一步，重新整理仍可完成", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));
  const deed = await seedPredecessor();
  await page.goto(`/deeds/${deed.id}`);
  await page.getByRole("link", { name: "我也想做", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await evidence(page, "UAT-15-return-login");
  await page.getByLabel("Email").fill("deep-link@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("直接從故事來的新手");
  await page.getByRole("button", { name: "開發用登入" }).click();
  await expect(page).toHaveURL(new RegExp(`/steps/new\\?deedId=${deed.id}`));
  await page.reload();
  await expect(page.getByRole("heading", { name: "前人的第一步" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "完成後" })).toContainText("音樂坊小廣場");
  await evidence(page, "UAT-15-refresh-source");
  await page.getByLabel("第一步", { exact: true }).fill("今天跟著一首歌哼唱");
  await page.getByRole("button", { name: "確定這一步" }).click();
  await expect(page).toHaveURL(/\/steps$/);
  await expect(page.getByRole("heading", { name: "「今天跟著一首歌哼唱」" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "我做到了", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("link", { name: "看看這個事蹟" }).click();
  await expect(page.getByRole("heading", { name: "「今天跟著一首歌哼唱」" })).toBeVisible();
  await expect(page.getByRole("link", { name: "音樂坊小廣場", exact: true })).toBeVisible();
  await evidence(page, "UAT-15-own-deed");
  await page.reload();
  await expect(page.getByRole("heading", { name: "「今天跟著一首歌哼唱」" })).toBeVisible();
  await page.goto("/mirror");
  await expect(page.getByRole("link", { name: /音樂坊小廣場/ })).toBeVisible();
  await evidence(page, "UAT-15-mirror");
  await json(page.request.post("/api/auth/logout"));
  await page.goto("/steps");
  await expect(page).toHaveURL(/\/login\?next=%2Fsteps/);
  await page.getByLabel("Email").fill("deep-link@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("直接從故事來的新手");
  await page.getByRole("button", { name: "開發用登入" }).click();
  await expect(page).toHaveURL(/\/steps$/);
  await page.getByRole("tab", { name: /完成了/ }).click();
  await expect(page.getByRole("heading", { name: "「今天跟著一首歌哼唱」" })).toBeVisible();
  await evidence(page, "UAT-15-session-return");
  expect(errors).toEqual([]);
});

test("UAT-17 長Email與長英文內容在個人頁、步驟、事蹟與鏡子不會撐出畫面", async ({ page }) => {
  const email = "first.time.longjiao.novice.with.a.long.name@example.test";
  await json(page.request.post("/api/auth/dev-login", { data: { email, name: "第一次來的小鎮居民" } }));
  await json(page.request.put("/api/me/character", { data: { name: "探索畫面的小龍", appearance: look(), personality: "", sharing: { allowAiQuotes: true } } }));
  const text = "https://example.test/" + "a".repeat(160);
  const want = await json(page.request.post("/api/me/wants", { data: { text: "想學會唱一首英文歌", districtKey: "music" } }));
  const step = await json(page.request.post("/api/first-steps", { data: { text, executor: "self", wantId: want.id } }));
  const { deed } = await json(page.request.post(`/api/first-steps/${step.id}/complete`, { data: { noteAfter: text, noteShared: true } }));
  for (const [i, route] of ["/me", "/steps", `/deeds/${deed.id}`, "/mirror", "/me/character"].entries()) {
    await page.goto(route);
    if (route === "/steps") await page.getByRole("tab", { name: /完成了/ }).click();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("載入中……", { exact: true })).toHaveCount(0);
    await evidence(page, `UAT-17-long-content-${i}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} should fit the viewport`).toBeLessThanOrEqual(test.info().project.use.viewport!.width);
  }
});
