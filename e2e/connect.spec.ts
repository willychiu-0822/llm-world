import { expect } from "@playwright/test";
import { test } from "./helpers";
import { growToStageTwo, loginPage, mcpConnect, tool } from "./helpers";

test("Codex instructions are on the connect page, and disconnect cuts the AI off", async ({ browser }) => {
  const page = await loginPage(browser, "connect@e2e.test", "連線");
  await growToStageTwo(page);
  await page.goto("/connect");
  const body = page.locator("main");
  for (const word of ["MCP", "be_my_character", "codex", "用戶端"]) {
    await expect(body.getByText(word, { exact: false }).first()).toBeHidden();
  }
  await page.getByRole("button", { name: "開始連接" }).click();
  await expect(page.getByText("你平常用哪一個聊天？")).toBeVisible();
  await page.getByRole("button", { name: "先不用" }).click();
  await expect(page.getByText("不連也能繼續玩")).toBeVisible();
  await page.getByRole("button", { name: "我想了想，還是看看" }).click();
  await page.getByRole("button", { name: "Claude", exact: true }).click();
  await expect(page.getByRole("button", { name: "複製網址" })).toBeVisible();
  await expect(page.getByText("三步就好")).toBeVisible();
  await page.getByText("進階", { exact: true }).click();
  await expect(page.getByText(/codex mcp add longjiao --url/)).toBeVisible();
  await expect(page.getByText("codex mcp login longjiao")).toBeVisible();
  await expect(page.getByText("還沒有連上的朋友")).toBeVisible();

  const ai = await mcpConnect(page);
  await page.goto("/connect");
  await expect(page.getByText("E2E 測試 AI")).toBeVisible();
  await expect(page.getByText("最後使用")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "中斷連接" }).click();
  await expect(page.getByRole("status")).toContainText("已中斷連接");
  await expect(page.getByText("還沒有連上的朋友")).toBeVisible();
  await expect(tool(ai, "character_get")).rejects.toThrow();
  await ai.close();
});
