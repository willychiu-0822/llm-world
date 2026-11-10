import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { test, json, look } from "./helpers";

const BANNED = ["AI", "MCP", "token", "agent", "provider", "事蹟", "鏡子", "許可證", "發現匣", "隨筆", "你應該", "越小越好", "映照", "可能的自己"];

async function shot(page: Page, id: string) {
  const dir = "docs/uat/evidence/uiux-audit/after";
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${id}.png` });
}

async function textOf(page: Page) {
  return page.evaluate(() => document.body.innerText);
}

async function checkState(page: Page, id: string) {
  await shot(page, id);
  const text = await textOf(page);
  expect(text, id).not.toContain("點旁邊");
  expect(text, id).not.toContain("點任意處");
  expect(text, id).not.toContain("那那");
  expect(text, id).not.toMatch(/[a-z]{2}_[A-Za-z0-9]/);
  for (const word of BANNED) expect(text, `${id} saw ${word}`).not.toContain(word);

  const dialogs = page.getByRole("dialog");
  for (let i = 0; i < await dialogs.count(); i++) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible())) continue;
    await expect(dialog, id).toHaveAttribute("aria-modal", "true");
    const name = (await dialog.getAttribute("aria-label")) || (await dialog.getAttribute("aria-labelledby"));
    expect(name, id).toBeTruthy();
    await expect(dialog.locator(".btn.primary"), id).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "關閉" }), id).toBeVisible();
  }

  const layout = await page.evaluate(() => {
    const shown = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    };
    const primaries = [...document.querySelectorAll(".btn.primary")].filter((el) => {
      if (!shown(el)) return false;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 22));
      return !!hit && (hit === el || el.contains(hit));
    }).length;
    const small = [...document.querySelectorAll("button, a")].flatMap((el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return [];
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return [];
      if (r.width < 44 || r.height < 44) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
        return [`${Math.round(r.width)}x${Math.round(r.height)} ${label}`];
      }
      return [];
    });
    const pointer = [...document.querySelectorAll("span, div")].filter((el) => getComputedStyle(el).cursor === "pointer" && !el.closest("a, button, label, summary")).map((el) => el.className?.toString?.().slice(0, 40) || el.tagName);
    return { primaries, small, pointer };
  });
  expect(layout.primaries, `${id} primary buttons`).toBe(1);
  expect(layout.small, `${id} tap targets`).toEqual([]);
  expect(layout.pointer, `${id} pointer on plain elements`).toEqual([]);

  const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const problems = contrast.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary?.split("\n")[0] ?? ""}`));
  expect(problems, `${id} contrast`).toEqual([]);
}

test("檢核 A1–A5、B1–B3、C1–C3、F1–F2、D3", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const http: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() < 400) return;
    if (!url.includes("/api/")) return;
    if (url.endsWith("/api/session") || url.endsWith("/api/me")) return;
    http.push(`${res.status()} ${url}`);
  });

  const mia = await page.request.post("/api/auth/dev-login", { data: { email: "check-mia@e2e.test", name: "Mia" } });
  expect(mia.ok()).toBeTruthy();
  await json(page.request.put("/api/me/character", { data: { name: "小雀", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: true } } }));
  for (const text of ["去上一次聲樂課", "在樂器行摸一把吉他"]) {
    const step = await json(page.request.post("/api/first-steps", { data: { executor: "self", text } }));
    await json(page.request.post(`/api/first-steps/${step.id}/complete`, { data: {} }));
  }
  await page.request.post("/api/auth/logout");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "龍角鎮" })).toBeVisible();
  await checkState(page, "01-guest");

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await expect(page.getByRole("heading", { name: "登入後就能把寶寶帶回家" })).toBeVisible();
  await checkState(page, "02-login");

  let logins = 0;
  const countLogin = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/api/auth/dev-login")) logins += 1;
  };
  page.on("request", countLogin);
  await page.getByLabel("Email").fill("check-baby@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("新手");
  await page.getByRole("button", { name: "開發用登入" }).dblclick();
  await page.getByRole("link", { name: "把牠撿回家" }).waitFor();
  expect(logins, "A5 login").toBe(1);
  page.off("request", countLogin);

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await expect(page.getByRole("heading", { name: "圓圓的，還是高高的？" })).toBeVisible();
  await checkState(page, "03-adopt-body");
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("heading", { name: "頭上要長什麼？" })).toBeVisible();
  await checkState(page, "04-adopt-head");
  await page.getByRole("button", { name: "上一步" }).click();
  await expect(page.getByRole("heading", { name: "圓圓的，還是高高的？" })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("角色名字").fill("小龍");
  await checkState(page, "05-adopt-name");
  await page.getByRole("button", { name: "帶牠回家" }).click();
  await expect(page.getByRole("button", { name: "去找牠" })).toBeVisible();
  await checkState(page, "06-hatch");
  await page.reload();
  await expect(page.getByRole("button", { name: "去找牠" })).toBeVisible();
  await page.getByRole("button", { name: "去找牠" }).click();
  await expect(page.getByRole("button", { name: "出門逛逛" })).toBeVisible();
  await checkState(page, "07-home");

  let walks = 0;
  const countWalk = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/api/me/walk")) walks += 1;
  };
  page.on("request", countWalk);
  let taps = 0;
  await page.getByRole("button", { name: "出門逛逛" }).click();
  taps += 1;
  await expect(page.getByText("小龍出門了")).toBeVisible();
  await checkState(page, "09-walking");
  await expect(page.getByRole("button", { name: "我也去摸摸看" })).toBeVisible();
  expect(walks, "A5 walk").toBe(1);
  page.off("request", countWalk);
  await checkState(page, "10-keepsake");

  let accepts = 0;
  const countAccept = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().endsWith("/api/first-steps")) accepts += 1;
  };
  page.on("request", countAccept);
  await page.getByRole("button", { name: "我也去摸摸看" }).dblclick();
  taps += 1;
  await expect(page.getByRole("button", { name: "我做到了！" })).toBeVisible();
  expect(accepts, "A5 accept").toBe(1);
  page.off("request", countAccept);
  await checkState(page, "11-tries");

  await page.getByRole("button", { name: "我做到了！" }).click();
  taps += 1;
  const celebrate = page.getByRole("dialog", { name: "做到了" });
  await expect(celebrate).toBeVisible();
  await expect(celebrate.getByRole("button", { name: "收下星星" })).toBeVisible();
  expect(taps, "B1").toBeLessThanOrEqual(3);
  await checkState(page, "12-celebrate");
  await page.keyboard.press("Escape");
  await expect(celebrate).toHaveCount(0);
  await expect(page.getByRole("button", { name: "我做到了！" })).toBeVisible();

  await page.getByRole("button", { name: "我做到了！" }).click();
  let claims = 0;
  const countClaim = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/complete")) claims += 1;
  };
  page.on("request", countClaim);
  await page.getByRole("button", { name: "😆" }).click();
  await page.getByRole("button", { name: "收下星星" }).dblclick();
  await expect(page.getByText("★ 1/3")).toBeVisible();
  expect(claims, "A5 claim").toBe(1);
  page.off("request", countClaim);
  await checkState(page, "13-home-star");
  await expect(page.getByRole("link", { name: "去收藏櫃看看" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: test.info().project.name === "mobile" ? "快速導覽" : "主要導覽" });
  await nav.getByRole("link", { name: "圖鑑" }).click();
  await expect(page.getByRole("heading", { name: "收藏櫃" })).toBeVisible();
  await expect(page.getByText("那一排")).toHaveCount(0);
  await checkState(page, "14-cabinet");
  await page.locator(".keepsake-cell:not(.is-missing)").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await checkState(page, "15-cabinet-detail");
  await page.getByRole("button", { name: "關閉" }).click();
  await nav.getByRole("link", { name: "家" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "郵筒" }).click();
  await expect(page.getByRole("dialog", { name: "郵筒" })).toBeVisible();
  await checkState(page, "16-mailbox");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await checkState(page, "17-settings");
  await page.getByRole("link", { name: "家" }).first().click();
  await expect(page).toHaveURL(/\/$/);

  for (let n = 0; n < 6; n++) {
    const step = await json(page.request.post("/api/first-steps", { data: { executor: "self", text: `小事${n}` } }));
    await json(page.request.post(`/api/first-steps/${step.id}/complete`, { data: {} }));
  }
  await page.reload();
  await page.getByRole("button", { name: "郵筒" }).click();
  const letter = page.getByRole("dialog", { name: "小龍的信" });
  await expect(letter).toBeVisible();
  await checkState(page, "18-letter");
  await page.getByRole("button", { name: "關閉" }).click();
  await page.getByRole("button", { name: "郵筒" }).click();
  await expect(letter).toBeVisible();
  await letter.getByRole("link", { name: "我有在用 ChatGPT／Claude" }).click();
  await expect(page.getByRole("heading", { name: "會說話的朋友" })).toBeVisible();
  await checkState(page, "19-connect");
  await page.getByRole("link", { name: "回小龍身邊" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "地圖", exact: true })).toBeVisible();
  await checkState(page, "20-map");
  await page.getByRole("link", { name: "回小龍身邊" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors, "F1 console").toEqual([]);
  expect(http, "F1 http").toEqual([]);
});
