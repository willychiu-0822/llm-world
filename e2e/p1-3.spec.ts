import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json } from "./helpers";

test("UAT-04 領養每一步的選項至少三欄，下一步在兩點五個螢幕內", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "character-layout@e2e.test" } }));
  await page.goto("/me/character");
  await expect(page.getByRole("heading", { name: "圓圓的，還是高高的？" })).toBeVisible();
  if (test.info().project.name === "mobile") {
    const pick = page.locator(".pick").first();
    const boxes = await pick.locator("button").evaluateAll((nodes) => nodes.map((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
    expect(boxes.filter((b) => Math.abs(b.y - boxes[0].y) < 2).length).toBeGreaterThanOrEqual(3);
    const nextY = await page.getByRole("button", { name: "下一步" }).evaluate((n) => n.getBoundingClientRect().bottom + scrollY);
    expect(nextY).toBeLessThanOrEqual(844 * 2.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByLabel("角色名字")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await evidence(page, "UAT-04-character-layout");
});
