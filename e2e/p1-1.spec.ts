import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence } from "./helpers";

test("UAT-02 P1-1 Google login stays hidden while config loads and unavailable start explains why", async ({ page }) => {
  await page.route("**/api/config", async route => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // Sample throughout the delay, catching the flash rather than just the final state.
  for (let i = 0; i < 20; i++) {
    expect(await page.getByRole("link", { name: "使用 Google 帳號登入" }).count()).toBe(0);
    await page.waitForTimeout(100);
  }
  await expect(page.getByRole("button", { name: "開發用登入" })).toBeVisible();
  await page.goto("/auth/google/start?next=/mirror");
  await expect(page).toHaveURL(/\/login\?error=google_unavailable/);
  await expect(page.getByText(/Google 登入尚未開放/)).toBeVisible();
  await evidence(page, "UAT-02-google-unavailable");
});
