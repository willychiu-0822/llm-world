import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json } from "./helpers";

test("UAT-04 P1-3 角色選項手機至少三欄且儲存在兩點五個螢幕內", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "character-layout@e2e.test" } }));
  await page.goto("/me/character");
  await expect(page.getByLabel("角色名字")).toBeVisible();
  if (test.info().project.name === "mobile") {
    for (const pick of await page.locator(".pick").all()) {
      const boxes = await pick.locator("button").evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      expect(boxes.filter(b => Math.abs(b.y - boxes[0].y) < 2).length).toBeGreaterThanOrEqual(3);
    }
    const saveY = await page.getByRole("button", { name: "儲存角色" }).evaluate(n => n.getBoundingClientRect().bottom + scrollY);
    expect(saveY).toBeLessThanOrEqual(844 * 2.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await evidence(page, "UAT-04-character-layout");
});
