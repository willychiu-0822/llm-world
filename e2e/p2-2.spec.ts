import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, seedPredecessor } from "./helpers";

test("UAT-07 P2-2 訪客逛首頁、地點與舊頁門禁沒有 console error", async ({ page }) => {
  const deed = await seedPredecessor();
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));
  for (const [i, url] of ["/", "/places/pub_music", `/deeds/${deed.id}`].entries()) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "把牠撿回家", exact: true }).or(page.getByRole("heading", { name: "小龍還沒長大", exact: true })).or(page.getByRole("heading", { name: "音樂坊小廣場", exact: true })).first()).toBeVisible();
    await evidence(page, `UAT-07-visitor-${i}`);
  }
  expect(errors).toEqual([]);
});
