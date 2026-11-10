import { expect, type Page } from "@playwright/test";
import { test, evidence, json } from "./helpers";

async function signIn(page: Page) {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "ui@e2e.test", name: "第一次來" } }));
}

async function layoutAndEvidence(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(test.info().project.use.viewport!.width);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const actions = page.locator("main a:visible, main button:visible");
  const last = actions.last();
  if (await last.count()) {
    const box = await last.boundingBox();
    const tab = await page.locator(".tabbar").boundingBox();
    if (box && tab) expect(box.y + box.height).toBeLessThanOrEqual(tab.y);
  }
  await evidence(page, name);
}

test("UAT-14a 空狀態都能直接走到下一步", async ({ page }) => {
  await signIn(page);
  for (const [route, heading] of [["/steps", "我的步驟"], ["/mirror", "鏡子"], ["/notifications", "通知"], ["/discoveries", "發現匣"]]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText("載入中……", { exact: true })).toHaveCount(0);
    const empties = page.locator("main .empty");
    for (const empty of await empties.all()) await expect(empty.locator("a, button").first()).toBeVisible();
    await layoutAndEvidence(page, `UAT-14a-${route.slice(1)}`);
  }
  await page.goto("/steps");
  for (const tab of [/AI 的建議/, /完成了/]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.locator("main .empty").locator("a, button").first()).toBeVisible();
    await evidence(page, `UAT-14a-steps-${tab.source === "完成了" ? "done" : "ai"}`);
  }
  const town = await json(page.request.get("/api/town"));
  await page.goto(`/places/${town.places.find((p: { districtKey: string }) => p.districtKey === "music").id}`);
  await expect(page.locator("main .empty a").first()).toBeVisible();
  await layoutAndEvidence(page, "UAT-14a-empty-place");
});

test("UAT-14b 多筆步驟與完成表單只有一個主要操作且可取消", async ({ page }) => {
  await signIn(page);
  for (const text of ["先在家唱一首歌", "再跟朋友唱一次"]) await json(page.request.post("/api/first-steps", { data: { executor: "self", text } }));
  await page.goto("/steps");
  await expect(page.getByRole("button", { name: "我做到了", exact: true })).toHaveCount(2);
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await evidence(page, "UAT-14b-step-list");
  await page.getByRole("button", { name: "我做到了", exact: true }).last().click();
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "完成", exact: true })).toHaveClass(/primary/);
  await layoutAndEvidence(page, "UAT-14b-complete-form");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("form", { name: "完成這一步" })).toHaveCount(0);
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
});

test("UAT-14c 測試登入說明可照做且寫下願望後可去地圖", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "開發用登入" })).toHaveClass(/primary/);
  await expect(page.getByText(/填入.*Email.*名字/)).toBeVisible();
  await layoutAndEvidence(page, "UAT-14c-login");
  await signIn(page);
  await page.goto("/me/character");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("角色名字").fill("新來的小龍");
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "帶牠回家" }).click();
  await page.getByRole("button", { name: "去找牠" }).click();
  await expect(page.getByRole("button", { name: "出門逛逛" })).toBeVisible();
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await layoutAndEvidence(page, "UAT-14c-home");
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "地圖", exact: true })).toBeVisible();
});

test("UAT-14d 提供者與管理者的等待畫面和空狀態有下一步", async ({ page }) => {
  await signIn(page);
  const provider = await json(page.request.post("/api/provider/apply", { data: { name: "新來的歌唱小店" } }));
  await page.goto("/provider");
  await expect(page.getByText(/申請審核中/)).toBeVisible();
  await expect(page.getByRole("link", { name: "先回地圖逛逛" })).toBeVisible();
  await layoutAndEvidence(page, "UAT-14d-provider-pending");
  await json(page.request.post("/api/auth/dev-login", { data: { email: "admin@e2e.test" } }));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理", exact: true })).toBeVisible();
  await expect(page.getByText("載入中……", { exact: true })).toHaveCount(0);
  for (const empty of await page.locator("main .empty").all()) await expect(empty.locator("a, button").first()).toBeVisible();
  await layoutAndEvidence(page, "UAT-14d-admin");
  await json(page.request.post(`/api/admin/providers/${provider.id}/approve`));
  await signIn(page);
  await page.goto("/provider");
  await expect(page.getByRole("heading", { name: "我的店", exact: true })).toBeVisible();
  await expect(page.getByText("載入中……", { exact: true })).toHaveCount(0);
  for (const empty of await page.locator("main .empty").all()) await expect(empty.locator("a, button").first()).toBeVisible();
  await expect(page.locator("main .btn.primary:visible")).toHaveCount(1);
  await layoutAndEvidence(page, "UAT-14d-provider-start");
});
