import { expect } from "@playwright/test";
import { test, evidence } from "./helpers";

test("UAT-16 P2-6 首頁載入與截圖不依賴外部字型服務", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fonts.push(r.url()); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "歡迎來到龍角鎮" })).toBeVisible();
  expect(fonts).toEqual([]);
  await evidence(page, "UAT-16-local-fonts");
});
