import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json, seedPredecessor } from "./helpers";

test("UAT-05 P1-4 前人第一步引用文字有完整寬度", async ({ page }) => {
  const deed = await seedPredecessor();
  await json(page.request.post("/api/auth/dev-login", { data: { email: "reference-layout@e2e.test" } }));
  await page.goto(`/steps/new?deedId=${deed.id}`);
  const card = page.locator(".predecessor").filter({ hasText: deed.title });
  await expect(card).toBeVisible();
  if (test.info().project.name === "mobile") {
    const size = await card.locator(".grow").evaluate(n => ({ width: n.getBoundingClientRect().width, fontSize: parseFloat(getComputedStyle(n).fontSize) }));
    expect(size.width / size.fontSize).toBeGreaterThanOrEqual(12);
    expect((await card.boundingBox())!.height).toBeLessThan(200);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await evidence(page, "UAT-05-reference-card");
});
