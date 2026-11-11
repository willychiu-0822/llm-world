import { expect } from "@playwright/test";
import { test, json, growToStageTwo } from "./helpers";

test("A6 長頁下方完成時也能看見並關閉提示", async ({page}) => {
  await json(page.request.post("/api/auth/dev-login", {data:{email:`notice-scroll-${test.info().project.name}@e2e.test`}}));
  await growToStageTwo(page);
  for (let i = 0; i < 10; i++) await json(page.request.post("/api/first-steps", {data:{executor:"self", text:`河邊的小事 ${i}`}}));
  await page.goto("/steps");
  const card = page.getByRole("article").filter({hasText:"河邊的小事 0"});
  await card.getByRole("button", {name:"我做到了"}).click();
  await card.getByRole("button", {name:"完成",exact:true}).click();
  await expect(page.locator(".toast")).toBeInViewport({ratio: 1});
  await expect(page.locator(".toast").getByRole("button", {name:"關閉提示"})).toBeInViewport({ratio: 1});
  const unobscured = await page.locator(".toast").evaluate(el => {
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".toast") === el;
  });
  expect(unobscured).toBe(true);
  await page.screenshot({path:`docs/uat/evidence/${test.info().project.name}-A6-long-page-notice.png`});
  await page.locator(".toast").getByRole("button", {name:"關閉提示"}).click();
  await expect(page.locator(".toast")).toHaveCount(0);
});
