import { LIFE_ACTIVITIES } from "../packages/core/src/life";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { test, json, look, panToPlace, growToStageTwo } from "./helpers";

const BANNED = ["AI", "MCP", "token", "agent", "provider", "事蹟", "鏡子", "許可證", "發現匣", "隨筆", "你應該", "越小越好", "映照", "可能的自己"];

test("隱私權頁首屏有回家按鈕", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "回小龍身邊" })).toBeInViewport();
});

async function shot(page: Page, id: string) {
  const dir = process.env.VERIFY_SHOTS ?? "docs/uat/evidence/uiux-audit/after";
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

  const mia = await page.request.post("/api/auth/dev-login", { data: { email: `check-mia-${test.info().project.name}-${Date.now()}@e2e.test`, name: "Mia" } });
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

  await page.goto("/map");
  await panToPlace(page, /萬事屋門口/);
  await page.getByRole("link", { name: /萬事屋門口/ }).click();
  await expect(page.getByRole("heading", { name: "萬事屋門口" })).toBeVisible();
  await checkState(page, "01b-place");
  await page.getByRole("button", { name: "看看這顆信物" }).click();
  await expect(page.getByRole("button", { name: "我也去摸摸看" })).toBeVisible();
  await checkState(page, "01c-keepsake-detail");
  await page.getByRole("button", { name: "關閉" }).click();
  await page.goto("/");

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await expect(page.getByRole("heading", { name: "登入後就能把寶寶帶回家" })).toBeVisible();
  await checkState(page, "02-login");

  let logins = 0;
  const countLogin = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/api/auth/dev-login")) logins += 1;
  };
  page.on("request", countLogin);
  await page.getByLabel("Email").fill(`check-baby-${test.info().project.name}-${Date.now()}@e2e.test`);
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
  if (test.info().project.name === "desktop") {
    const baby = await page.locator(".baby-hit").boundingBox();
    expect(baby?.width ?? 0, "desktop baby width").toBeGreaterThanOrEqual(240);
  }

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

  let claims = 0;
  const countClaim = (req: { method: () => string; url: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/complete")) claims += 1;
  };
  page.on("request", countClaim);
  await page.getByRole("button", { name: "我做到了！" }).dblclick();
  taps += 1;
  const celebrate = page.getByRole("dialog", { name: "做到了" });
  await expect(celebrate).toBeVisible();
  await expect(celebrate.getByRole("button", { name: "收下星星" })).toBeVisible();
  await expect(celebrate.getByRole("button", { name: "先不要" })).toHaveCount(0);
  expect(taps, "B1").toBeLessThanOrEqual(3);
  expect((await (await page.request.get("/api/me")).json()).pet.stars, "star credited before dismiss").toBe(1);
  expect(claims, "A5 claim").toBe(1);
  await checkState(page, "12-celebrate");
  await page.getByRole("button", { name: "關閉" }).click();
  await expect(page.getByText("★ 1/3")).toBeVisible();
  await expect(page.getByRole("button", { name: "我做到了！" })).toHaveCount(0);

  await json(page.request.post("/api/first-steps", { data: { executor: "self", text: "再做一件小事" } }));
  await page.goto("/tries");
  await page.getByRole("button", { name: "我做到了！" }).click();
  await expect(page.getByRole("dialog", { name: "做到了" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("★ 2/3")).toBeVisible();
  expect(claims, "Esc keeps the star").toBe(2);
  page.off("request", countClaim);
  await checkState(page, "13-home-star");
  if (test.info().project.name === "desktop") {
    const baby = await page.locator(".baby-hit").boundingBox();
    const pack = await page.locator(".backpack").boundingBox();
    expect(baby && pack, "desktop backpack").toBeTruthy();
    const overlaps = !!baby && !!pack && pack.x < baby.x + baby.width && pack.x + pack.width > baby.x && pack.y < baby.y + baby.height && pack.y + pack.height > baby.y;
    expect(overlaps, "backpack stays on the baby").toBe(true);
    await shot(page, "13b-desktop-backpack");
  }
  await expect(page.getByRole("link", { name: "去收藏櫃看看" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: test.info().project.name === "mobile" ? "快速導覽" : "主要導覽" });
  await nav.getByRole("link", { name: "收藏櫃" }).click();
  await expect(page.getByRole("heading", { name: "收藏櫃" })).toBeVisible();
  await expect(page.getByText("那一排")).toHaveCount(0);
  const progress = (await page.getByLabel("收藏進度").innerText()).trim();
  const catalog = Number(progress.split("/")[1]);
  await expect(page.locator(".keepsake-cell")).toHaveCount(catalog);
  await expect(page.locator(".keepsake-cell.is-missing")).toHaveCount(catalog - await page.locator(".keepsake-cell:not(.is-missing)").count());
  await expect(page.getByText(/收到了/)).toBeVisible();
  const fresh = page.locator(".keepsake-cell.is-new");
  await expect(fresh).toHaveCount(1);
  await expect(page.locator(".keepsake-cell:not(.is-missing)").first()).toHaveClass(/is-new/);
  const freshBox = await fresh.boundingBox();
  expect(freshBox!.y).toBeLessThan(test.info().project.use.viewport!.height);
  await checkState(page, "14-cabinet");
  await page.locator(".keepsake-cell:not(.is-missing)").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "收好信物" })).toBeVisible();
  await checkState(page, "15-cabinet-detail");
  await page.getByRole("button", { name: "關閉" }).click();
  await nav.getByRole("link", { name: "家" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "郵筒" }).click();
  await expect(page.getByRole("dialog", { name: "郵筒" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "郵筒" }).getByRole("button", { name: "關上郵筒" })).toBeVisible();
  await checkState(page, "16-mailbox");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await checkState(page, "17-settings");
  await page.locator("details.advanced summary").click();
  await expect(page.getByRole("link", { name: "幫手" })).toHaveCount(0);
  await page.getByRole("link", { name: "服務條款" }).click();
  let legal = await textOf(page);
  for (const word of BANNED) expect(legal, `terms ${word}`).not.toContain(word);
  await page.goto("/privacy");
  legal = await textOf(page);
  for (const word of BANNED) expect(legal, `privacy ${word}`).not.toContain(word);
  await expect(page.getByRole("link", { name: "回小龍身邊" })).toBeInViewport();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/connect");
  await expect(page.getByRole("heading", { name: "小龍還沒長大" })).toBeVisible();
  const gated = await textOf(page);
  expect(gated).not.toContain("MCP");
  expect(gated).not.toContain("AI");
  expect(gated).not.toContain("ChatGPT");
  await checkState(page, "17b-connect-gate");
  await page.goto("/");

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
  await letter.getByRole("link", { name: "會說話的朋友" }).click();
  await expect(page.getByRole("heading", { name: "會說話的朋友" })).toBeVisible();
  await checkState(page, "19-connect");
  await page.getByRole("link", { name: "回小龍身邊" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "地圖", exact: true })).toBeVisible();
  await checkState(page, "20-map");
  await expect(page.getByRole("link", { name: "去音樂坊小廣場" })).toBeVisible();
  await nav.getByRole("link", { name: "家" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors, "F1 console").toEqual([]);
  expect(http, "F1 http").toEqual([]);
});

test("檢核 G1–G8：小龍有自己的今天、七種生活與四類收藏", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await json(page.request.post("/api/auth/dev-login", {data: {email: `life-${test.info().project.name}@e2e.test`}}));
  await json(page.request.put("/api/me/character", {data: {name: "栗子", appearance: look(), sharing: {allowAiQuotes: false}}}));
  await page.goto("/");
  await page.getByRole("link", {name: "小龍的今天"}).click();
  await expect(page.getByRole("heading", {name: "小龍的今天"})).toBeVisible();
  await expect(page.getByText("想要什麼？", {exact: true})).toBeVisible();
  await checkState(page, "G01-today");
  const before = await json(page.request.get("/api/me/life"));
  await page.reload();
  await expect(page.getByText(before.today.autonomous, {exact:true})).toBeVisible();
  await checkState(page, "G02-today-reload");
  await page.getByRole("button", {name: "陪牠去玩", exact:true}).click();
  await checkState(page, "G03-choices-cancel");
  await page.getByRole("button", {name: "先待在家"}).click();
  expect((await json(page.request.get("/api/me/life"))).today.entries).toHaveLength(0);
  let submissions = 0;
  page.on("request", req => { if (req.method() === "POST" && req.url().endsWith("/life/activities")) submissions++; });
  for (const [i, a] of LIFE_ACTIVITIES.entries()) {
    await page.getByRole("button", {name: "陪牠去玩", exact:true}).click();
    await page.getByRole("radio", {name: new RegExp(a.name), exact:false}).click();
    await checkState(page, `G04-${a.id}-preview`);
    await page.getByRole("button", {name: "就去這裡"}).dblclick();
    await expect(page.getByRole("dialog", {name: "帶回小驚喜"})).toBeVisible();
    expect(submissions).toBe(i+1);
    await checkState(page, `G05-${a.id}-result`);
    if (i === 0) await page.keyboard.press("Escape");
    else if (i === 1) await page.getByRole("button", {name: "關閉", exact:true}).click();
    else await page.getByRole("button", {name: "收好紀念品"}).click();
    await page.reload();
    await expect(page.locator(".life-entry")).toHaveCount(i+1);
    await page.evaluate(() => window.scrollTo(0,0));
    await checkState(page, `G06-${a.id}-saved`);
  }
  expect((await json(page.request.get("/api/me"))).pet.stars).toBe(0);
  await page.getByRole("link", {name: "看看今天帶回來的"}).click();
  await expect(page.getByLabel("生活收藏進度")).toHaveText("7/7");
  await checkState(page, "G07-life-cabinet");
  for (const a of LIFE_ACTIVITIES) {
    await page.getByRole("button", {name: `${a.reward}，已收集`, exact:true}).click();
    await checkState(page, `G08-${a.id}-detail`);
    if (a.id === "shop") await page.getByRole("button", {name:"穿上圍巾"}).click();
    else if (a.id === "festival") await page.getByRole("button", {name:"擺在家裡"}).click();
    else await page.getByRole("button", {name: "收好", exact:true}).click();
  }
  await page.getByRole("link", {name: "回小龍身邊", exact:true}).click();
  await expect(page.getByLabel("穿著雲朵圍巾")).toBeVisible();
  await expect(page.getByLabel("房間的四季小燈")).toBeVisible();
  await expect(page.locator(".baby-hit .life-outfit")).toBeVisible();
  await expect(page.locator(".baby-stage > .life-decoration")).toBeVisible();
  await checkState(page, "G09-decorated-home");
  await page.reload();
  await expect(page.getByLabel("房間的四季小燈")).toBeVisible();
  await page.goto("/life/cabinet");
  await page.getByRole("button", {name:"雲朵圍巾，已收集",exact:true}).click();
  await page.getByRole("button", {name:"收回圍巾"}).click();
  await page.getByRole("button", {name:"四季小燈，已收集",exact:true}).click();
  await page.getByRole("button", {name:"收起小燈"}).click();
  await page.goto("/");
  await expect(page.getByLabel("穿著雲朵圍巾")).toHaveCount(0);
  await expect(page.getByLabel("房間的四季小燈")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("檢核 G8：新頁未領養、斷網重試、未收集與鍵盤返回", async ({page}) => {
  await page.goto("/life");
  await expect(page).toHaveURL(/login/);
  await json(page.request.post("/api/auth/dev-login", {data:{email:"life-empty@e2e.test"}}));
  await page.goto("/life");
  await expect(page.getByRole("heading", {name:"小龍還在蛋裡"})).toBeVisible();
  await checkState(page, "G10-no-dragon");
  await json(page.request.put("/api/me/character", {data:{name:"小雨",appearance:look()}}));
  await page.route("**/api/me/life", route => route.fulfill({status:503,json:{error:{code:"unavailable",message:"unavailable"}}}));
  await page.goto("/life");
  await expect(page.getByRole("button", {name:"再看一次"})).toBeVisible();
  await checkState(page, "G11-retry");
  await page.unroute("**/api/me/life");
  await page.getByRole("button", {name:"再看一次"}).click();
  await expect(page.getByRole("button", {name:"陪牠去玩"})).toBeVisible();
  await page.goto("/life/cabinet");
  await expect(page.getByLabel("生活收藏進度")).toHaveText("0/7");
  await checkState(page, "G12-empty-cabinet");
  await page.getByRole("button", {name:"雲朵圍巾，還沒帶回家",exact:true}).click();
  await checkState(page, "G13-missing-item");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", {name:"雲朵圍巾，還沒帶回家",exact:true})).toBeFocused();
  await page.getByRole("link", {name:"回小龍身邊",exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
});

test("B4 重新整理常用頁面保留角色與生活資料", async ({ page }) => {
  test.setTimeout(120_000);
  await json(page.request.post("/api/auth/dev-login", { data: { email: `reload-${test.info().project.name}@e2e.test` } }));
  await growToStageTwo(page, "小圓");
  await json(page.request.post("/api/me/life/activities", { data: { activityId: "shop" } }));
  const before = await json(page.request.get("/api/me"));
  const lifeBefore = await json(page.request.get("/api/me/life"));
  for (const [path, text] of [
    ["/", "小圓"], ["/map", "地圖"], ["/places/pub_misc", "萬事屋門口"],
    ["/cabinet", "收藏櫃"], ["/life", "小龍的今天"], ["/life/cabinet", "生活收藏"],
    ["/tries", "接下"], ["/steps", "一步"], ["/steps/new", "第一步"],
    ["/connect", "會說話的朋友"], ["/me", "設定"], ["/notifications", "通知"],
  ]) {
    await page.goto(path!);
    await expect(page.locator("main")).toContainText(text!);
    await page.reload();
    await expect(page.locator("main")).toContainText(text!);
    await page.screenshot({ path: `docs/uat/evidence/${test.info().project.name}-B4-${path === "/" ? "home" : path!.slice(1).replaceAll("/", "-")}.png` });
  }
  const after = await json(page.request.get("/api/me"));
  const lifeAfter = await json(page.request.get("/api/me/life"));
  expect(after.pet.stars).toBe(before.pet.stars);
  expect(after.pet.stage).toBe(before.pet.stage);
  expect(lifeAfter.today).toEqual(lifeBefore.today);
  expect(lifeAfter.inventory).toEqual(lifeBefore.inventory);
});
