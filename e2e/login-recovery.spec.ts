import { expect } from "@playwright/test";
import { test, evidence } from "./helpers";

test("UAT-18 登入設定失敗可重試，恢復後可登入且不閃出Google", async ({ page }) => {
  let fail = true;
  await page.route("**/api/config", async route => {
    if (fail) await route.fulfill({ status: 503, json: { error: "temporarily unavailable" } });
    else await route.continue();
  });
  await page.goto("/login");
  await expect(page.getByRole("alert")).toContainText("無法取得登入方式");
  await expect(page.getByRole("link", { name: "使用 Google 帳號登入" })).toHaveCount(0);
  await evidence(page, "UAT-18-config-failed");
  fail = false;
  await page.getByRole("button", { name: "重新載入登入方式" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "使用 Google 帳號登入" })).toHaveCount(0);
  await page.getByLabel("Email").fill("retry@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("重試的新手");
  await page.getByRole("button", { name: "開發用登入" }).click();
  await expect(page.getByRole("link", { name: "設定角色", exact: true })).toBeVisible();
  await evidence(page, "UAT-18-recovered");
});
