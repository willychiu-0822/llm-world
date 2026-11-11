import { expect } from "@playwright/test";
import { test, json, growToStageTwo } from "./helpers";

test("第 2 階完成表單送出中防止重複提交", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: `completion-submit-${test.info().project.name}@e2e.test` } }));
  await growToStageTwo(page);
  const step = await json(page.request.post("/api/first-steps", { data: { executor: "self", text: "去看一朵花" } }));
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/first-steps/${step.id}/complete`, async route => {
    requests++;
    await pending;
    await route.continue();
  });
  await page.goto("/steps");
  const card = page.locator("article").filter({ hasText: "去看一朵花" });
  await card.getByRole("button", { name: "我做到了" }).click();
  const submit = card.locator('button[type="submit"]');
  await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  try {
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("正在收好…");
    expect(requests).toBe(1);
  } finally {
    release();
  }
  await expect(page.getByText("太好了！這件事留下了")).toBeVisible();
});
