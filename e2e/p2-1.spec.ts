import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json } from "./helpers";

test("UAT-06 P2-1 初次儲存角色後帶到想做的事且訊息不遮表單", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "onboarding@e2e.test" } }));
  await page.goto("/me/character");
  await page.getByLabel("角色名字").fill("小芽");
  await page.getByRole("button", { name: "儲存角色" }).click();
  const want = page.getByLabel("想做的事", { exact: true });
  await expect(want).toBeFocused();
  await expect(want).toBeInViewport();
  await expect(page.getByText(/下一步：寫下一件想做的事/)).toBeVisible();
  for (const message of await page.getByRole("status").all()) {
    const m = await message.boundingBox();
    if (!m) continue;
    for (const control of await page.locator("input, select").all()) {
      const c = await control.boundingBox();
      if (c) expect(m.x < c.x + c.width && m.x + m.width > c.x && m.y < c.y + c.height && m.y + m.height > c.y).toBe(false);
    }
  }
  await evidence(page, "UAT-06-next-want");
});
