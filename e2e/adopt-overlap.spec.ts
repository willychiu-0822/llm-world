import { expect } from "@playwright/test";
import { test, json } from "./helpers";

test("領養配色時操作列不遮住畫面內的顏色選項", async ({page}) => {
  await json(page.request.post("/api/auth/dev-login", {data: {email:`adopt-overlap-${test.info().project.name}@e2e.test`}}));
  await page.goto("/");
  await page.getByRole("link", {name:"把牠撿回家"}).click();
  await page.getByRole("button", {name:"下一步"}).click();
  await expect(page.getByRole("heading", {name:"頭上要長什麼？"})).toBeVisible();
  await expect(page.getByRole("button", {name:"下一步"})).toBeInViewport({ratio:1});
  await page.screenshot({path:`docs/uat/evidence/${test.info().project.name}-adopt-colors-initial.png`});
  const overlaps = await page.evaluate(() => {
    const controls = document.querySelector(".adopt-actions")!.getBoundingClientRect();
    const section = document.querySelector(".adopt > section")!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLButtonElement>(".adopt .swatch")].filter(button => {
      const rect = button.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, section.top, 0), visibleBottom = Math.min(rect.bottom, section.bottom, innerHeight);
      return visibleBottom > visibleTop && rect.right > controls.left && rect.left < controls.right && visibleBottom > controls.top && visibleTop < controls.bottom;
    }).map(button => button.getAttribute("aria-label"));
  });
  expect(overlaps).toEqual([]);
  for (const swatch of await page.locator(".adopt .swatch").all()) {
    await swatch.click();
    await expect(swatch).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", {name:"下一步"})).toBeInViewport();
  }
});
