import { expect } from "@playwright/test";
import { test } from "./helpers";
import { loginPage, mcpConnect, tool } from "./helpers";

test("Codex instructions are on the connect page, and disconnect cuts the AI off", async ({ browser }) => {
  const page = await loginPage(browser, "connect@e2e.test", "連線");
  await page.goto("/connect");
  await expect(page.getByText(/codex mcp add longjiao --url/)).toBeVisible();
  await expect(page.getByText("codex mcp login longjiao")).toBeVisible();
  await expect(page.getByText("用其他 AI 連接")).toBeVisible();
  await expect(page.getByText("還沒有連接中的 AI")).toBeVisible();

  const ai = await mcpConnect(page);
  await page.goto("/connect");
  await expect(page.getByText("E2E 測試 AI")).toBeVisible();
  await expect(page.getByText("最後使用")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "中斷連接" }).click();
  await expect(page.getByRole("status")).toHaveText("已中斷連接");
  await expect(page.getByText("還沒有連接中的 AI")).toBeVisible();
  await expect(tool(ai, "character_get")).rejects.toThrow();
  await ai.close();
});
