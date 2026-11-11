import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, growToStageTwo, json } from "./helpers";

test("UAT-03 P1-2 完成後立刻看得到剛完成的步驟與事蹟", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "complete@e2e.test" } }));
  await growToStageTwo(page);
  await json(page.request.post("/api/first-steps", { data: { executor: "self", text: "第一次試著唱一首歌" } }));
  await page.goto("/steps");
  await page.getByRole("button", { name: "我做到了", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "「第一次試著唱一首歌」" })).toBeVisible({ timeout: 3000 });
  const link = page.getByRole("article").filter({ hasText: "第一次試著唱一首歌" }).getByRole("link", { name: "看看這件事" });
  await expect(link).toBeVisible({ timeout: 3000 });
  await expect(link).toBeInViewport();
  await expect(page.getByRole("tab", { name: /完成了/ })).toHaveAttribute("aria-selected", "true");
  await evidence(page, "UAT-03-completed-step");
  await link.click();
  await expect(page).toHaveURL(/\/deeds\/deed_/);
  await expect(page.getByRole("heading", { name: "「第一次試著唱一首歌」" })).toBeVisible();
});
