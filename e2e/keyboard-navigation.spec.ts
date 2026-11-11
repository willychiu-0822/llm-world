import { expect, type Locator, type Page } from "@playwright/test";
import { test, json, growToStageTwo, apiAs, look } from "./helpers";

// Exercise the browser's actual sequential focus order, including mobile layout.
async function checkKeyboard(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main .btn.primary").first()).toBeVisible();
  await page.locator("main").click({ position: { x: 2, y: 2 } });
  const visited = new Set<string>();
  let reachedMainAction = false;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const path: string[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        path.push(`${node.tagName}:${node.parentElement ? [...node.parentElement.children].indexOf(node) : 0}`);
      }
      return {
        key: path.join("/"),
        inMain: !!el.closest("main"),
        action: el.matches("button, a, input, select, textarea"),
        focusVisible: el.matches(":focus-visible"),
        indicator: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== "none" || !!el.closest(".choice-card"),
      };
    });
    if (!state) break;
    if (visited.has(state.key)) break;
    visited.add(state.key);
    expect(state.focusVisible, `${path}: ${state.key}`).toBe(true);
    expect(state.indicator, `${path}: ${state.key}`).toBe(true);
    if (state.inMain && state.action) reachedMainAction = true;
  }
  expect(reachedMainAction, `${path} has a keyboard-reachable main action`).toBe(true);
}

test("F2 主要頁面可用鍵盤抵達操作且焦點可見", async ({ page }) => {
  test.setTimeout(120_000);
  await json(page.request.post("/api/auth/dev-login", { data: { email: `keyboard-${test.info().project.name}@e2e.test` } }));
  await growToStageTwo(page);
  for (const path of ["/", "/map", "/cabinet", "/life", "/life/cabinet", "/tries", "/steps", "/steps/new", "/connect", "/me", "/notifications"]) {
    await checkKeyboard(page, path);
  }
});

async function keyboardFocus(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate(el => el === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard could not reach ${await target.textContent()}`);
}

async function keyboardActivate(page: Page, target: Locator) {
  await keyboardFocus(page, target);
  await page.keyboard.press("Enter");
}

test("F2 領養與信物對話框可用鍵盤完成", async ({ page }) => {
  test.setTimeout(120_000);
  const neighbor = await apiAs(`keyboard-neighbor-${test.info().project.name}@e2e.test`);
  await json(neighbor.put("/api/me/character", { data: { name: "小雀", appearance: look("flower") } }));
  const step = await json(neighbor.post("/api/first-steps", { data: { executor: "self", text: "去上一次聲樂課" } }));
  await json(neighbor.post(`/api/first-steps/${step.id}/complete`, { data: {} }));
  await neighbor.dispose();
  await json(page.request.post("/api/auth/dev-login", { data: { email: `keyboard-adopt-${test.info().project.name}@e2e.test` } }));
  await page.goto("/");
  await keyboardActivate(page, page.getByRole("link", { name: "把牠撿回家" }));
  await expect(page.getByRole("heading", { name: "圓圓的，還是高高的？" })).toBeVisible();
  await keyboardActivate(page, page.getByRole("button", { name: "下一步" }));
  await keyboardActivate(page, page.getByRole("button", { name: "下一步" }));
  const name = page.getByLabel("角色名字");
  await keyboardFocus(page, name);
  await page.keyboard.type("Dragon");
  await keyboardActivate(page, page.getByRole("button", { name: "帶牠回家" }));
  await keyboardActivate(page, page.getByRole("button", { name: "去找牠" }));
  await page.goto("/places/pub_misc");
  await keyboardActivate(page, page.getByRole("button", { name: "看看這顆信物" }));
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "看看這顆信物" })).toBeFocused();
  await keyboardActivate(page, page.getByRole("button", { name: "看看這顆信物" }));
  await keyboardActivate(page, dialog.getByRole("button", { name: "我也去摸摸看" }));
  await expect(page.getByRole("button", { name: "我做到了！" })).toBeVisible();
});

test("F2 生活活動和收藏對話框可用鍵盤操作", async ({ page }) => {
  test.setTimeout(120_000);
  await json(page.request.post("/api/auth/dev-login", { data: { email: `keyboard-life-${test.info().project.name}@e2e.test` } }));
  await json(page.request.put("/api/me/character", { data: { name: "小龍", appearance: look() } }));
  await page.goto("/life");
  const play = page.getByRole("button", { name: "陪牠去玩" });
  await keyboardActivate(page, play);
  const choices = page.getByRole("dialog", { name: "陪小龍去玩" });
  await expect(choices).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(play).toBeFocused();
  await keyboardActivate(page, play);
  await keyboardActivate(page, choices.getByRole("button", { name: "就去這裡" }));
  const result = page.getByRole("dialog", { name: "帶回小驚喜" });
  await expect(result).toBeVisible();
  await keyboardActivate(page, result.getByRole("button", { name: "收好紀念品" }));
  await keyboardActivate(page, page.getByRole("link", { name: "打開生活收藏" }));
  const owned = page.getByRole("button", { name: /已收集/ }).first();
  await keyboardActivate(page, owned);
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(owned).toBeFocused();
});
