import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json } from "./helpers";

test("UAT-06 領養後孵化並回到家，不再塞一張願望表", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "onboarding@e2e.test" } }));
  await page.goto("/me/character");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("角色名字").fill("小芽");
  await page.getByRole("button", { name: "帶牠回家" }).click();
  await expect(page.getByText("嗨！我是小芽。")).toBeVisible();
  await expect(page.locator(".hatch")).toBeVisible();
  await page.getByRole("button", { name: "去找牠" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "出門逛逛" })).toBeVisible();
  await expect(page.getByLabel("想做的事")).toHaveCount(0);
  await evidence(page, "UAT-06-hatch-home");
});
