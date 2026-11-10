import { expect } from "@playwright/test";
import { test } from "./helpers";
import { apiAs, evidence, json, look } from "./helpers";

const BANNED = ["AI", "MCP", "token", "agent", "provider", "連接器", "用戶端", "伺服器", "事蹟", "主題區", "鏡子", "隨筆", "本人執行", "定義", "映照", "許可證", "可能的自己", "明信片", "越小越好", "不計分", "勇氣", "踏出", "第一步", "你應該", "試著", "記得", "反思"];

async function expectClean(page: import("@playwright/test").Page) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const word of BANNED) expect(text, `saw ${word}`).not.toContain(word);
}

test("新手：領養、出門、信物、做到了、收藏", async ({ page }) => {
  const mia = await apiAs("novice-mia@e2e.test", "Mia");
  await json(mia.put("/api/me/character", { data: { name: "小雀", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: true } } }));
  for (const text of ["去上一次聲樂課", "在樂器行摸一把吉他"]) {
    const step = await json(mia.post("/api/first-steps", { data: { executor: "self", text } }));
    await json(mia.post(`/api/first-steps/${step.id}/complete`, { data: {} }));
  }
  await mia.dispose();

  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "龍角鎮" })).toBeVisible();
  await expect(page.getByRole("link", { name: "把牠撿回家" })).toBeVisible();
  await expectClean(page);
  await evidence(page, "novice-01-guest");

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await expect(page.getByRole("heading", { name: "登入後就能把寶寶帶回家" })).toBeVisible();
  await expectClean(page);
  await page.getByLabel("Email").fill("novice@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("新手小安");
  await page.getByRole("button", { name: "開發用登入" }).click();

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await expect(page.getByRole("heading", { name: "圓圓的，還是高高的？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一步" })).toHaveCount(1);
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByText("頭上要長什麼？")).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("角色名字").fill("小龍");
  await expectClean(page);
  await page.getByRole("button", { name: "帶牠回家" }).click();
  await expect(page.getByText("嗨！我是小龍。")).toBeVisible();
  await expect(page.locator(".hatch")).toBeVisible();
  await page.getByRole("button", { name: "去找牠" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "出門逛逛" })).toBeVisible();
  await expect(page.locator("main .btn.primary")).toHaveCount(1);
  await expectClean(page);
  await evidence(page, "novice-02-home");

  await page.getByRole("button", { name: "小龍" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.getByRole("button", { name: "出門逛逛" }).click();
  await expect(page.getByRole("button", { name: "我也去摸摸看" })).toBeVisible();
  await expect(page.getByText("小背包背好了。")).toBeVisible();
  await expect(page.locator("[aria-label='小背包']")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectClean(page);
  await evidence(page, "novice-03-keepsake");

  await page.getByRole("button", { name: "我也去摸摸看" }).click();
  await expect(page.getByText("我幫你記著喔。")).toBeVisible();
  await expect(page.getByRole("button", { name: "我做到了！" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expectClean(page);
  await evidence(page, "novice-04-tries");

  await page.getByRole("button", { name: "我做到了！" }).click();
  const dialog = page.getByRole("dialog", { name: "做到了" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("★ +1");
  await expect(dialog).toContainText("★ 1/3");
  await expect(dialog).toContainText("收下星星");
  await expect(dialog).not.toContainText("點旁邊");
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "😆" }).click();
  await page.getByRole("button", { name: "收下星星" }).click();
  await expect(page.getByText(/★ 1\/3/)).toBeVisible();
  await expectClean(page);
  await evidence(page, "novice-05-home-star");

  const nav = page.getByRole("navigation", { name: test.info().project.name === "mobile" ? "快速導覽" : "主要導覽" });
  await nav.getByRole("link", { name: "圖鑑" }).click();
  await expect(page.getByRole("heading", { name: "收藏櫃" })).toBeVisible();
  await expect(page.getByLabel("收藏進度")).toHaveText("1/2");
  await expect(page.locator(".is-missing")).toHaveCount(1);
  await expectClean(page);
  await evidence(page, "novice-06-cabinet");

  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "地圖", exact: true })).toBeVisible();
  await expect(page.getByText(/滾輪/)).toHaveCount(0);
  await expectClean(page);

  await page.goto("/places/pub_misc");
  await expect(page.getByText("萬事屋的旅人")).toBeVisible();
  await expect(page.locator(".tag")).toHaveCount(0);
  await expectClean(page);
  await evidence(page, "novice-07-place");

  await page.goto("/me");
  const settings = await page.evaluate(() => document.body.innerText);
  expect(settings).not.toContain("AI");
  expect(settings).not.toContain("刪除帳號");
  expect(settings).not.toContain("提供者");
  await expectClean(page);
  await evidence(page, "novice-08-settings");

  await page.goto("/connect");
  await page.locator("details.advanced summary").click();
  await expect(page.locator("code", { hasText: "/mcp" })).toBeVisible();
  expect(errors).toEqual([]);
});
