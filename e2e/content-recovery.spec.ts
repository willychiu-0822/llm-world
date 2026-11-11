import { expect } from "@playwright/test";
import { test, apiAs, evidence, growToStageTwo, json, seedPredecessor } from "./helpers";

test("UAT-19 來源事蹟改為私人或試用連結失效時，先說明並引導回地圖", async ({ page }) => {
  const deed = await seedPredecessor();
  const owner = await apiAs("novice-mia@e2e.test", "Mia");
  await json(owner.patch(`/api/deeds/${deed.id}`, { data: { visibility: "private" } }));
  await owner.dispose();
  await json(page.request.post("/api/auth/dev-login", { data: { email: "saved-link@e2e.test", name: "從收藏回來的新手" } }));
  await growToStageTwo(page);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const [kind, query] of [["deed", `deedId=${deed.id}`], ["trial", "trialId=trl_no_longer_available"]]) {
    await page.goto(`/steps/new?${query}`);
    await expect(page.getByRole("heading", { name: "這個起點暫時無法使用" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("找不到這個內容");
    await expect(page.getByLabel("第一步", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "確定這一步" })).toHaveCount(0);
    await evidence(page, `UAT-19-${kind}-unavailable`);
    await page.getByRole("link", { name: "回地圖找靈感", exact: true }).click();
    await expect(page.locator("#map")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("UAT-19b 來源建議載入暫時失敗後，重試仍保留原主題與參考", async ({ page }) => {
  const deed = await seedPredecessor();
  await json(page.request.post("/api/auth/dev-login", { data: { email: "source-retry@e2e.test", name: "想再試一次的新手" } }));
  await growToStageTwo(page);
  let attempts = 0;
  await page.route("**/api/first-steps/suggestions?*", async route => {
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: { code: "internal" } } });
    await route.continue();
  });
  await page.goto(`/steps/new?deedId=${deed.id}`);
  await expect(page.getByRole("heading", { name: "這個起點暫時無法使用" })).toBeVisible();
  await expect(page.getByLabel("第一步", { exact: true })).toHaveCount(0);
  await evidence(page, "UAT-19b-source-retry");
  await page.getByRole("button", { name: "再試一次", exact: true }).click();
  await expect(page.getByRole("heading", { name: "前人的第一步" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "完成後" })).toContainText("音樂坊小廣場");
  await page.getByLabel("第一步", { exact: true }).fill("重試之後，跟著哼一首歌");
  await page.getByRole("button", { name: "確定這一步" }).click();
  await expect(page).toHaveURL(/\/steps$/);
  const steps = await json(page.request.get("/api/first-steps"));
  expect(steps[0].sourceDeedIds).toEqual([deed.id]);
  expect(attempts).toBe(2);
  await evidence(page, "UAT-19b-source-recovered");
});

