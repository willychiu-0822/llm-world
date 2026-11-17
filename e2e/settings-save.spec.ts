import { expect } from "@playwright/test";
import { json, look, loginPage, test } from "./helpers";

test("設定頁改脾氣與分享不必捲回上方就能存，重整後還在", async ({ browser }) => {
  const page = await loginPage(browser, "lw10-settings@e2e.test", "安");
  await json(page.request.put("/api/me/character", { data: { name: "小龍", appearance: look(), personality: "溫柔", sharing: { allowAiQuotes: true } } }));
  await page.goto("/me");
  await expect(page.getByRole("button", { name: "存起來" })).toBeVisible();
  await expect(page.getByRole("button", { name: "儲存名字" })).toHaveCount(0);

  await page.getByText("進階", { exact: true }).click();
  await page.getByLabel("脾氣").fill("喜歡曬太陽");
  await page.getByRole("button", { name: "把脾氣存起來" }).click();
  await expect(page.getByRole("status")).toHaveTextContent("存好了。");

  await page.getByLabel("做過的事可以說給鎮上的朋友聽").uncheck();
  await expect(page.getByRole("status")).toHaveTextContent("存好了。");

  await page.reload();
  await page.getByText("進階", { exact: true }).click();
  await expect(page.getByLabel("脾氣")).toHaveValue("喜歡曬太陽");
  await expect(page.getByLabel("做過的事可以說給鎮上的朋友聽")).not.toBeChecked();
});
