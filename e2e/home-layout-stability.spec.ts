import { expect } from "@playwright/test";
import { test, json, look, apiAs } from "./helpers";

test("出門回來時操作區和小龍位置保持穩定", async ({ page }) => {
  const source = await apiAs(`layout-source-${test.info().project.name}@e2e.test`);
  await json(source.put("/api/me/character", { data: { name: "阿游", appearance: look() } }));
  const step = await json(source.post("/api/first-steps", { data: { executor: "self", text: "聽了一首小曲" } }));
  await json(source.post(`/api/first-steps/${step.id}/complete`, { data: { visibility: "public" } }));
  await source.dispose();
  await json(page.request.post("/api/auth/dev-login", { data: { email: `layout-${test.info().project.name}@e2e.test` } }));
  await json(page.request.put("/api/me/character", { data: { name: "小豆", appearance: look() } }));
  await page.goto("/");
  await page.getByRole("button", { name: "出門逛逛" }).click();
  await expect(page.getByText(/小龍出門了/)).toBeVisible();
  const before = await page.locator(".baby-actions").boundingBox();
  const babyBefore = await page.locator(".baby-stage").boundingBox();
  await expect(page.getByRole("button", { name: "我也去摸摸看" })).toBeVisible();
  const after = await page.locator(".baby-actions").boundingBox();
  const babyAfter = await page.locator(".baby-stage").boundingBox();
  expect(before && after && babyBefore && babyAfter).toBeTruthy();
  expect(Math.abs(before!.width - after!.width)).toBeLessThan(2);
  expect(Math.abs(babyBefore!.y - babyAfter!.y)).toBeLessThan(2);
});
