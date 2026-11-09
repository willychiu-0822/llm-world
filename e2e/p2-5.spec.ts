import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence } from "./helpers";

test("UAT-10 P2-5 訪客頂部登入入口可見可點", async ({ page }) => {
  await page.goto("/");
  const login = page.getByRole("banner").getByRole("link", { name: "登入", exact: true });
  await expect(login).toBeVisible();
  await evidence(page, "UAT-10-header-login");
  await login.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "開發用登入" })).toBeVisible();
});
