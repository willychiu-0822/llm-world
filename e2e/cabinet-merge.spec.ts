import { expect } from "@playwright/test";
import { json, look, test } from "./helpers";

test("收藏櫃只有一個，舊的生活收藏網址轉到小龍帶回來的", async ({ page }) => {
  const email = `cabinet-${test.info().project.name}@e2e.test`;
  await json(page.request.post("/api/auth/dev-login", { data: { email, name: "櫃" } }));
  await json(page.request.put("/api/me/character", { data: { name: "小龍", appearance: look() } }));
  const before = await json(page.request.get("/api/me/life"));
  const open = before.activities.find((a: { open: boolean; done: boolean }) => a.open && !a.done);
  expect(open, "today has an open activity").toBeTruthy();
  const played = await json(
    page.request.post("/api/me/life/activities", { data: { activityId: open.id } }),
  );
  const keepsakes = await json(page.request.get("/api/me/keepsakes"));

  await page.goto("/life");
  const fromLife = page.getByRole("link", { name: "打開收藏櫃" });
  await expect(fromLife).toHaveAttribute("href", "/cabinet#life");
  await expect(page.getByRole("link", { name: "打開生活收藏" })).toHaveCount(0);
  const broughtHome = page.getByRole("link", { name: "看看今天帶回來的" });
  if ((await broughtHome.count()) > 0) {
    await expect(broughtHome).toHaveAttribute("href", "/cabinet#life");
  }
  await fromLife.click();

  await expect(page).toHaveURL(/\/cabinet#life$/);
  await expect(page.getByRole("heading", { name: "收藏櫃", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "生活收藏" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "鎮民的信物" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "小龍帶回來的" })).toBeInViewport();
  await expect(page.locator(".keepsake-cell")).toHaveCount(9);
  await expect(page.locator(".life-item")).toHaveCount(7);
  await expect(page.getByLabel("收藏進度")).toBeVisible();
  await expect(page.getByLabel("小龍帶回來的進度")).toHaveText(`${played.inventory.length}/7`);
  await expect(
    page.getByRole("button", { name: `${open.reward}，已收集`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "收藏櫃", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "收藏櫃", exact: true })).toHaveClass(/active/);

  await page.goto("/life/cabinet");
  await expect(page).toHaveURL(/\/cabinet#life$/);
  await expect(page.getByRole("heading", { name: "小龍帶回來的" })).toBeInViewport();
  await page.reload();
  await expect(page).toHaveURL(/\/cabinet#life$/);
  await expect(page.locator(".keepsake-cell")).toHaveCount(9);
  await expect(page.locator(".life-item")).toHaveCount(7);
  const lifeAfter = await json(page.request.get("/api/me/life"));
  const keepsAfter = await json(page.request.get("/api/me/keepsakes"));
  expect(lifeAfter.inventory).toEqual(played.inventory);
  expect(keepsAfter.items).toEqual(keepsakes.items);
});
