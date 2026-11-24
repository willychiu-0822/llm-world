import { expect } from "@playwright/test";
import { apiAs, evidence, json, look, test } from "./helpers";

test("空鎮：出門逛逛不出紅字，帶回見聞，主按鈕換成下一件事", async ({ page }) => {
  // The fixture clears all users, so nobody else has left a keepsake in town.
  const me = await apiAs("empty-town@e2e.test", "空鎮新手");
  await json(
    me.put("/api/me/character", {
      data: { name: "小龍", appearance: look(), personality: "", sharing: { allowAiQuotes: true } },
    }),
  );
  await me.dispose();

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("empty-town@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("空鎮新手");
  await page.getByRole("button", { name: "開發用登入" }).click();
  await page.waitForURL(/\/$/);

  await page.getByRole("button", { name: "出門逛逛" }).click();
  await expect(page.getByText("鎮上還沒有新的信物")).toBeVisible();
  await expect(page.getByText("小背包背好了。")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("今天沒有新信物")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "出門逛逛" })).toHaveCount(0);
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "小龍的今天" })).toHaveClass(/primary/);
  await evidence(page, "empty-town-sight");

  // Back on a fresh load the walk is over for today, and the main button still leads somewhere new.
  await page.reload();
  await expect(page.getByRole("button", { name: "出門逛逛" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "小龍的今天" })).toHaveClass(/primary/);

  // The cabinet no longer sends the player back to a button that cannot succeed.
  await page.goto("/cabinet");
  await expect(page.getByRole("link", { name: "去找一顆信物" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "小龍的今天" })).toHaveClass(/primary/);
});
