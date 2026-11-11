import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const BASE = process.env.VERIFY_BASE ?? "http://localhost:4132";
const OUT = process.env.VERIFY_OUT ?? "docs/uat/verify-codex/baseline-1105";
const BANNED = ["AI", "MCP", "token", "agent", "provider", "事蹟", "鏡子", "許可證", "發現匣", "隨筆", "你應該", "越小越好", "映照", "可能的自己", "點旁邊", "點任意處", "先不要", "圖鑑", "ChatGPT"];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1280, height: 800, isMobile: false, hasTouch: false },
];

function contrastRatio(fg, bg) {
  const lum = (c) => {
    const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const L1 = lum(fg), L2 = lum(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function parseRgb(str) {
  const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

async function collectLayout(page) {
  return page.evaluate(() => {
    const shown = (el) => {
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
    });
    const small = [...document.querySelectorAll("button, a")].flatMap((el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return [];
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return [];
      if (r.width < 44 || r.height < 44) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        return [`${Math.round(r.width)}x${Math.round(r.height)} ${label}`];
      }
      return [];
    });
    const pointer = [...document.querySelectorAll("span, div")].filter((el) => getComputedStyle(el).cursor === "pointer" && !el.closest("a, button, label, summary")).map((el) => (el.className?.toString?.() || el.tagName).slice(0, 60));
    const buttons = [...document.querySelectorAll("button, a.btn, a")].filter(shown).map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: (el.className?.toString?.() || "").slice(0, 80),
        text: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
        width: Math.round(r.width), height: Math.round(r.height),
        primary: el.classList.contains("primary"),
        color: s.color, background: s.backgroundColor,
      };
    });
    const main = document.querySelector("main");
    const baby = document.querySelector(".baby-hit");
    const babyBox = baby && shown(baby) ? baby.getBoundingClientRect() : null;
    const home = document.querySelector(".baby-home");
    const homeStyle = home ? getComputedStyle(home) : null;
    const cell = document.querySelector(".keepsake-cell");
    const cellBox = cell && shown(cell) ? cell.getBoundingClientRect() : null;
    const d = document.querySelector('[role="dialog"]');
    return {
      url: location.href,
      text: document.body.innerText,
      primaries: primaries.map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim()),
      primaryCount: primaries.length,
      small, pointer, buttons,
      toast: !!document.querySelector(".toast"),
      baby: babyBox ? { width: Math.round(babyBox.width), height: Math.round(babyBox.height) } : null,
      homeDisplay: homeStyle ? { display: homeStyle.display, columns: homeStyle.gridTemplateColumns, textAlign: homeStyle.textAlign } : null,
      cell: cellBox ? { width: Math.round(cellBox.width), height: Math.round(cellBox.height) } : null,
      newCellInView: (() => {
        const n = document.querySelector(".keepsake-cell.is-new");
        if (!n) return false;
        const r = n.getBoundingClientRect();
        return r.top >= 0 && r.top < innerHeight;
      })(),
      cabinetCells: document.querySelectorAll(".keepsake-cell").length,
      cabinetMissing: document.querySelectorAll(".keepsake-cell.is-missing").length,
      backpack: (() => {
        const pack = document.querySelector(".backpack");
        if (!pack || !shown(pack) || !babyBox) return null;
        const r = pack.getBoundingClientRect();
        const overlaps = r.x < babyBox.x + babyBox.width && r.x + r.width > babyBox.x && r.y < babyBox.y + babyBox.height && r.y + r.height > babyBox.y;
        return { width: Math.round(r.width), height: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), overlapsBaby: overlaps };
      })(),
      viewport: { width: innerWidth, height: innerHeight },
      dialog: d ? {
        ariaModal: d.getAttribute("aria-modal"),
        titleText: d.querySelector("h2, #dialog-title")?.textContent ?? "",
        buttons: [...d.querySelectorAll("button, a")].map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim()),
      } : null,
    };
  });
}

function scanText(text) {
  const hits = [];
  for (const w of BANNED) if (text.includes(w)) hits.push(w);
  if (/那那/.test(text)) hits.push("那那");
  const ids = text.match(/\b[a-z]{2}_[A-Za-z0-9]+/g);
  if (ids) hits.push(...ids.map((x) => `id:${x}`));
  const sentences = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return { bannedHits: hits, longSentences: sentences.filter((s) => s.length > 25 && !s.includes("@") && !s.startsWith("http")), sentences };
}

async function shot(page, name) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  const full = path.join(OUT, `${name}-full.png`);
  await page.screenshot({ path: file, fullPage: false });
  await page.screenshot({ path: full, fullPage: true });
  return { file, full };
}

async function inspect(page, name) {
  const shots = await shot(page, name);
  const layout = await collectLayout(page);
  const scan = scanText(layout.text || "");
  const contrasts = [];
  for (const b of layout.buttons.filter((x) => x.primary)) {
    const fg = parseRgb(b.color), bg = parseRgb(b.background);
    if (fg && bg && bg[0] + bg[1] + bg[2] > 0) contrasts.push({ text: b.text, ratio: Number(contrastRatio(fg, bg).toFixed(2)), fg: b.color, bg: b.background });
  }
  const layoutShifts = await page.evaluate(() => window.__auditLayoutShifts ?? []);
  return { name, url: page.url(), shots, layout, scan, contrasts, layoutShifts };
}

async function meJson(page) {
  const r = await page.request.get("/api/me");
  if (!r.ok()) return null;
  return r.json();
}

async function runViewport(browser, vp) {
  const result = {
    viewport: vp.name, states: [], errors: [], consoleErrors: [], httpErrors: [],
    tapsToReward: null, celebration: {}, oldRoutes: {}, oldRoutesGrown: {},
    reload: {}, concerns: {}, regressions: {}, reducedMotion: {},
  };
  const ctx = await browser.newContext({
    baseURL: BASE, viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    locale: "zh-TW", timezoneId: "Asia/Taipei", colorScheme: "light",
  });
  await ctx.addInitScript(() => {
    window.__auditLayoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__auditLayoutShifts.push({ value: entry.value, startTime: entry.startTime, sources: (entry.sources ?? []).map(source => ({ node: source.node?.outerHTML?.slice(0, 300), previous: source.previousRect?.toJSON(), current: source.currentRect?.toJSON() })) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const seed = await browser.newContext({baseURL: BASE});
  await seed.request.post("/api/auth/dev-login", {data:{email:`source-${vp.name}-${Date.now()}@e2e.test`,name:"阿游"}});
  await seed.request.put("/api/me/character", {data:{name:"阿游",appearance:{body:"round",accessory:"flower",main:"#F2C6A8",accent:"#A9C7DE",description:""},personality:"",sharing:{allowAiQuotes:true}}});
  const want = await (await seed.request.post("/api/me/wants", {data:{text:"想聽一首歌",districtKey:"music"}})).json();
  const step = await (await seed.request.post("/api/first-steps", {data:{executor:"self",text:"聽朋友彈了一首小曲",wantId:want.id}})).json();
  const completed = await (await seed.request.post(`/api/first-steps/${step.id}/complete`, {data:{visibility:"public"}})).json();
  const seedId = completed.deed.id;
  await seed.close();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => result.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") result.consoleErrors.push(m.text()); });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() < 400) return;
    if (!url.includes("/api/")) return;
    if (url.endsWith("/api/session") || url.endsWith("/api/me")) return;
    result.httpErrors.push(`${res.status()} ${url}`);
  });

  const email = `verify-r3-${vp.name}-${Date.now()}@uat.local`;
  const player = `驗${vp.name}`;
  result.email = email;

  // 01 guest
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "龍角鎮" }).waitFor();
  result.states.push(await inspect(page, `${vp.name}-01-guest`));
  const navText = await page.locator("nav").allInnerTexts();
  result.concerns.navLabels = navText;

  // Guest map → place → keepsake detail (should NOT be /deeds or 事蹟)
  await page.goto("/map", { waitUntil: "networkidle" });
  result.states.push(await inspect(page, `${vp.name}-01b-map`));
  const placeLink = page.locator("a[href*='/places/']").first();
  if (await placeLink.count()) {
    await placeLink.click();
    await page.waitForTimeout(600);
  } else {
    await page.goto("/places/pub_music", { waitUntil: "networkidle" });
  }
  result.states.push(await inspect(page, `${vp.name}-01c-place`));
  result.regressions.guestPlaceUrl = page.url();
  if (await page.getByRole("button", { name: "看看這顆信物" }).count()) {
    await page.getByRole("button", { name: "看看這顆信物" }).click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
    result.states.push(await inspect(page, `${vp.name}-01d-keepsake-detail`));
    result.regressions.guestDetailUrl = page.url();
    result.regressions.guestDetailHasDeedWord = (await page.locator("body").innerText()).includes("事蹟");
    result.regressions.guestDetailHasAccept = await page.getByRole("button", { name: "我也去摸摸看" }).isVisible();
    await page.getByRole("button", { name: "關閉" }).click();
    await page.waitForTimeout(300);
  }

  // login + adopt + hatch
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await page.getByRole("heading", { name: "登入後就能把寶寶帶回家" }).waitFor();
  result.states.push(await inspect(page, `${vp.name}-02-login`));
  let logins = 0;
  const countLogin = (req) => { if (req.method() === "POST" && req.url().includes("/api/auth/dev-login")) logins += 1; };
  page.on("request", countLogin);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("名字", { exact: true }).fill(player);
  await page.getByRole("button", { name: "開發用登入" }).dblclick();
  await page.getByRole("link", { name: "把牠撿回家" }).waitFor({ timeout: 15000 });
  result.celebration.loginRequests = logins;
  page.off("request", countLogin);

  await page.getByRole("link", { name: "把牠撿回家" }).click();
  await page.getByRole("heading", { name: "圓圓的，還是高高的？" }).waitFor();
  result.states.push(await inspect(page, `${vp.name}-03-adopt-body`));
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("heading", { name: "頭上要長什麼？" }).waitFor();
  result.states.push(await inspect(page, `${vp.name}-04-adopt-head`));
  if (await page.getByRole("button", { name: "上一步" }).count()) {
    await page.getByRole("button", { name: "上一步" }).click();
    await page.getByRole("heading", { name: "圓圓的，還是高高的？" }).waitFor();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "下一步" }).click();
  } else {
    await page.getByRole("button", { name: "下一步" }).click();
  }
  await page.getByLabel("角色名字").fill("小龍");
  result.states.push(await inspect(page, `${vp.name}-05-adopt-name`));
  await page.getByRole("button", { name: "帶牠回家" }).click();
  await page.getByRole("button", { name: "去找牠" }).waitFor({ timeout: 15000 });
  result.states.push(await inspect(page, `${vp.name}-06-hatch`));
  await page.reload({ waitUntil: "networkidle" });
  result.reload.hatchStillThere = await page.getByRole("button", { name: "去找牠" }).isVisible();
  const hatchClass = await page.locator(".hatch-baby").getAttribute("class").catch(() => "");
  result.reload.hatchAnimationStill = (hatchClass || "").includes("is-still");
  result.states.push(await inspect(page, `${vp.name}-06b-hatch-reload`));
  await page.getByRole("button", { name: "去找牠" }).click();

  await page.getByRole("button", { name: "出門逛逛" }).waitFor({ timeout: 15000 });
  result.states.push(await inspect(page, `${vp.name}-07-home`));
  result.concerns.desktopBaby = (await inspect(page, `${vp.name}-07-home`)).layout.baby;
  // already inspected; keep first
  result.states.pop();
  const babyBtn = page.getByRole("button", { name: "小龍" });
  if (await babyBtn.count()) {
    await babyBtn.click();
    await page.waitForTimeout(400);
    result.states.push(await inspect(page, `${vp.name}-08-poke`));
  }
  await page.reload({ waitUntil: "networkidle" });
  result.reload.homeAfterReloadHasWalk = await page.getByRole("button", { name: "出門逛逛" }).isVisible();
  result.states.push(await inspect(page, `${vp.name}-07b-home-reload`));

  // Pre-stage-2: settings 幫手 leak, legal, gated old routes
  await page.getByRole("link", { name: "設定" }).click();
  await page.getByRole("heading", { name: "設定" }).waitFor();
  result.states.push(await inspect(page, `${vp.name}-17-settings`));
  if (await page.locator("summary", { hasText: "進階" }).count()) {
    await page.locator("summary", { hasText: "進階" }).click();
    await page.waitForTimeout(200);
    result.states.push(await inspect(page, `${vp.name}-17b-settings-advanced`));
    result.regressions.settingsAdvancedLinks = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim() })));
    result.regressions.helperLinkBeforeStage2 = await page.getByRole("link", { name: "幫手" }).count();
    // Direct /connect must be gated even if the settings link is hidden
    await page.goto("/connect", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    result.states.push(await inspect(page, `${vp.name}-17c-connect-before-stage2`));
    const connectText = await page.locator("body").innerText();
    result.regressions.connectBeforeStage2 = {
      url: page.url(),
      gated: connectText.includes("小龍還沒長大"),
      hasMcp: connectText.includes("MCP") || connectText.includes("/mcp"),
      hasAI: connectText.includes("AI"),
      hasChatGPT: connectText.includes("ChatGPT"),
      hasStart: connectText.includes("開始連接"),
      text: connectText.slice(0, 500),
    };
    await page.goto("/me", { waitUntil: "networkidle" });
    if (await page.locator("summary", { hasText: "進階" }).count()) {
      const open = await page.locator("details.advanced").getAttribute("open");
      if (!open) await page.locator("summary", { hasText: "進階" }).click();
    }
    if (await page.getByRole("link", { name: "服務條款" }).count()) {
      await page.getByRole("link", { name: "服務條款" }).click();
      await page.waitForTimeout(400);
      result.states.push(await inspect(page, `${vp.name}-17d-terms`));
      await page.goto("/privacy", { waitUntil: "networkidle" });
      result.states.push(await inspect(page, `${vp.name}-17e-privacy`));
    }
  }

  for (const route of ["/steps", "/mirror", "/deeds", `/deeds/${seedId}`]) {
    const safe = route.replace(/\//g, "_").replace(/^_/, "");
    await page.goto(route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const st = await inspect(page, `${vp.name}-21-gated-${safe}`);
    const t = st.layout.text || "";
    result.oldRoutes[route] = {
      url: page.url(),
      gated: t.includes("小龍還沒長大"),
      hasDeedWord: t.includes("事蹟"),
      hasMirrorWord: t.includes("鏡子"),
      hasAI: t.includes("AI"),
      hasSuibi: t.includes("隨筆"),
      snippet: t.slice(0, 400),
    };
    result.states.push(st);
  }

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "出門逛逛" }).waitFor();

  let taps = 0, walks = 0;
  const countWalk = (req) => { if (req.method() === "POST" && req.url().includes("/api/me/walk")) walks += 1; };
  page.on("request", countWalk);
  await page.getByRole("button", { name: "出門逛逛" }).click();
  taps += 1;
  await page.getByText(/小龍出門了/).waitFor({ timeout: 10000 });
  result.states.push(await inspect(page, `${vp.name}-09-walking`));
  await page.getByRole("button", { name: "我也去摸摸看" }).waitFor({ timeout: 15000 });
  result.celebration.walkRequests = walks;
  page.off("request", countWalk);
  result.states.push(await inspect(page, `${vp.name}-10-keepsake`));
  await page.reload({ waitUntil: "networkidle" });
  result.reload.keepsakePersisted = await page.getByRole("button", { name: "我也去摸摸看" }).isVisible().catch(() => false);
  result.states.push(await inspect(page, `${vp.name}-10b-keepsake-reload`));

  let accepts = 0;
  const countAccept = (req) => { if (req.method() === "POST" && req.url().endsWith("/api/first-steps")) accepts += 1; };
  page.on("request", countAccept);
  await page.getByRole("button", { name: "我也去摸摸看" }).dblclick();
  taps += 1;
  await page.getByRole("button", { name: "我做到了！" }).waitFor({ timeout: 15000 });
  result.celebration.acceptRequests = accepts;
  page.off("request", countAccept);
  result.states.push(await inspect(page, `${vp.name}-11-tries`));
  result.regressions.hasDrawerButton = await page.getByRole("button", { name: "先收進抽屜" }).isVisible();
  result.regressions.hasEllipsisSummary = await page.locator("summary", { hasText: "…" }).count();

  // Refresh on tries
  await page.reload({ waitUntil: "networkidle" });
  result.reload.triesPersisted = await page.getByRole("button", { name: "我做到了！" }).isVisible();
  result.states.push(await inspect(page, `${vp.name}-11b-tries-reload`));

  let claims = 0;
  const countClaim = (req) => { if (req.method() === "POST" && req.url().includes("/complete")) claims += 1; };
  page.on("request", countClaim);
  await page.getByRole("button", { name: "我做到了！" }).dblclick();
  taps += 1;
  const celebrate = page.getByRole("dialog");
  await celebrate.waitFor({ state: "visible", timeout: 10000 });
  result.tapsToReward = taps;
  result.celebration.claimRequests = claims;
  const starsRightAfterClick = (await meJson(page))?.pet?.stars;
  result.celebration.starsAfterIDidIt = starsRightAfterClick;
  result.states.push(await inspect(page, `${vp.name}-12-celebrate`));
  const celeText = await celebrate.innerText();
  const celeButtons = await celebrate.locator("button").allTextContents();
  result.celebration.dialogText = celeText;
  result.celebration.buttons = celeButtons.map((t) => t.trim());
  result.celebration.hasNoThanks = celeButtons.some((t) => t.includes("先不要"));
  result.celebration.hasClaim = celeButtons.some((t) => t.includes("收下星星"));
  result.celebration.hasX = celeButtons.some((t) => t.includes("關閉") || t.trim() === "×");

  // X should keep star and go home
  if (await page.getByRole("button", { name: "😆" }).count()) await page.getByRole("button", { name: "😆" }).click();
  await page.getByRole("button", { name: "關閉" }).click();
  await page.waitForTimeout(600);
  result.celebration.xGoesHome = /\/$/.test(new URL(page.url()).pathname);
  result.celebration.xKeepsStarVisible = await page.getByText(/★\s*1\s*\/\s*3/).isVisible().catch(() => false);
  result.celebration.xDidItGone = (await page.getByRole("button", { name: "我做到了！" }).count()) === 0;
  result.celebration.starsAfterX = (await meJson(page))?.pet?.stars;
  result.states.push(await inspect(page, `${vp.name}-12b-x-keeps-star`));
  page.off("request", countClaim);

  // Esc on a second completion
  const step2 = await page.request.post("/api/first-steps", { data: { executor: "self", text: "再做一件小事" } });
  result.celebration.seed2 = step2.status();
  await page.goto("/tries", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "我做到了！" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
  result.celebration.starsBeforeEsc = (await meJson(page))?.pet?.stars;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  result.celebration.escGoesHome = /\/$/.test(new URL(page.url()).pathname);
  result.celebration.escKeepsStarVisible = await page.getByText(/★\s*2\s*\/\s*3/).isVisible().catch(() => false);
  result.celebration.starsAfterEsc = (await meJson(page))?.pet?.stars;
  const homeStar = await inspect(page, `${vp.name}-13-home-star`);
  result.states.push(homeStar);
  result.concerns.backpackAfterStar = homeStar.layout.backpack;
  result.concerns.babyAfterStar = homeStar.layout.baby;

  // Cabinet
  const navCab = page.getByRole("navigation").getByRole("link", { name: "收藏櫃" });
  if (await navCab.count()) await navCab.click();
  else if (await page.getByRole("link", { name: /收藏櫃/ }).count()) await page.getByRole("link", { name: /收藏櫃/ }).first().click();
  else await page.goto("/cabinet");
  await page.getByRole("heading", { name: "收藏櫃" }).waitFor({ timeout: 15000 });
  result.states.push(await inspect(page, `${vp.name}-14-cabinet`));
  result.concerns.cabinetPrimary = await page.locator(".btn.primary").allTextContents().then((a) => a.map((t) => t.trim()));
  result.concerns.cabinetGhostBack = await page.getByRole("link", { name: "回小龍身邊" }).isVisible().catch(() => false);
  result.concerns.cabinetProgress = await page.getByLabel("收藏進度").innerText().catch(() => "");
  result.concerns.cabinetHint = await page.locator(".cabinet .muted, .cabinet p").allInnerTexts().then((a) => a.join(" | "));
  result.concerns.newInView = (result.states.at(-1).layout.newCellInView);
  result.concerns.cellSize = result.states.at(-1).layout.cell;
  result.concerns.cabinetCells = result.states.at(-1).layout.cabinetCells;
  result.concerns.cabinetMissing = result.states.at(-1).layout.cabinetMissing;

  if (await page.getByRole("button", { name: "看看剛撿到的" }).count()) {
    await page.getByRole("button", { name: "看看剛撿到的" }).click();
  } else {
    const fresh = page.locator(".keepsake-cell.is-new, .keepsake-cell:not(.is-missing)").first();
    if (await fresh.count()) await fresh.click();
  }
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
  result.states.push(await inspect(page, `${vp.name}-15-cabinet-detail`));
  if (await page.getByRole("button", { name: "關閉" }).count()) await page.getByRole("button", { name: "關閉" }).click();
  else if (await page.getByRole("button", { name: "好" }).count()) await page.getByRole("button", { name: "好" }).click();
  await page.waitForTimeout(300);

  // Regression: place keepsake detail → 我也去摸摸看 → tries
  await page.goto("/places/pub_music", { waitUntil: "networkidle" });
  result.states.push(await inspect(page, `${vp.name}-20b-place-loggedin`));
  if (await page.getByRole("button", { name: "看看這顆信物" }).count()) {
    await page.getByRole("button", { name: "看看這顆信物" }).click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    result.states.push(await inspect(page, `${vp.name}-20c-place-detail`));
    await page.getByRole("button", { name: "我也去摸摸看" }).click();
    await page.waitForTimeout(800);
    result.regressions.placeAcceptUrl = page.url();
    result.regressions.placeAcceptHasDidIt = await page.getByRole("button", { name: "我做到了！" }).isVisible().catch(() => false);
    result.states.push(await inspect(page, `${vp.name}-20d-tries-from-place`));
    await page.reload({ waitUntil: "networkidle" });
    result.reload.triesFromPlacePersisted = await page.getByRole("button", { name: "我做到了！" }).isVisible().catch(() => false);
  }

  // Seed to stage 2 (need 7 stars; we have 2; place-accept may have added an open try, not a star)
  let starsNow = (await meJson(page))?.pet?.stars ?? 0;
  let n = 0;
  while (starsNow < 7 && n < 10) {
    const stepRes = await page.request.post("/api/first-steps", { data: { executor: "self", text: `小事${n}` } });
    if (stepRes.ok()) {
      const step = await stepRes.json();
      const done = await page.request.post(`/api/first-steps/${step.id}/complete`, { data: {} });
      if (!done.ok()) result.errors.push(`seed complete ${n}: ${done.status()} ${await done.text()}`);
    } else {
      result.errors.push(`seed step ${n}: ${stepRes.status()} ${await stepRes.text()}`);
    }
    starsNow = (await meJson(page))?.pet?.stars ?? starsNow;
    n += 1;
  }
  result.regressions.starsAfterSeed = starsNow;
  result.regressions.stageAfterSeed = (await meJson(page))?.pet?.stage;

  await page.goto("/", { waitUntil: "networkidle" });
  const stage2Home = await inspect(page, `${vp.name}-13b-home-stage2`);
  result.states.push(stage2Home);
  result.concerns.backpackStage2 = stage2Home.layout.backpack;
  result.concerns.babyStage2 = stage2Home.layout.baby;
  await page.getByRole("button", { name: "郵筒" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
  result.states.push(await inspect(page, `${vp.name}-18-letter`));
  result.concerns.letterText = await page.getByRole("dialog").innerText();
  result.concerns.letterHasNoThanks = result.concerns.letterText.includes("先不要");
  result.concerns.letterHasChatGPT = result.concerns.letterText.includes("ChatGPT");
  if (await page.getByRole("button", { name: "關閉" }).count()) await page.getByRole("button", { name: "關閉" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "郵筒" }).click();
  const letter = page.getByRole("dialog");
  await letter.waitFor({ state: "visible" });
  const friend = letter.getByRole("link", { name: "會說話的朋友" });
  if (await friend.count()) {
    await friend.click();
    await page.getByRole("heading", { name: "會說話的朋友" }).waitFor({ timeout: 10000 });
    result.states.push(await inspect(page, `${vp.name}-19-connect`));
    result.regressions.connectPrimary = await page.locator(".btn.primary").allTextContents().then((a) => a.map((t) => t.trim()));
    if (await page.getByRole("button", { name: "開始連接" }).count()) {
      await page.getByRole("button", { name: "開始連接" }).click();
      await page.waitForTimeout(400);
      result.states.push(await inspect(page, `${vp.name}-19b-connect-advanced`));
      const ct = await page.locator("body").innerText();
      result.regressions.connectAdvanced = {
        hasMcp: /\/mcp|MCP/.test(ct),
        hasUrl: /https?:\/\//.test(ct) || ct.includes("/mcp"),
        snippet: ct.slice(0, 800),
      };
    }
  }

  // Stage-2 settings should reveal 幫手 again
  await page.goto("/me", { waitUntil: "networkidle" });
  if (await page.locator("summary", { hasText: "進階" }).count()) {
    const open = await page.locator("details.advanced").getAttribute("open");
    if (!open) await page.locator("summary", { hasText: "進階" }).click();
  }
  result.states.push(await inspect(page, `${vp.name}-17f-settings-after-stage2`));
  result.regressions.helperLinkAfterStage2 = await page.getByRole("link", { name: "幫手" }).count();

  // Notifications leftover copy
  await page.goto("/notifications", { waitUntil: "networkidle" });
  result.states.push(await inspect(page, `${vp.name}-24-notifications`));

  // Stage-2+ old pages should work (not gated)
  for (const route of ["/steps", "/mirror", "/deeds", `/deeds/${seedId}`]) {
    const safe = route.replace(/\//g, "_").replace(/^_/, "");
    await page.goto(route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const st = await inspect(page, `${vp.name}-22-grown-${safe}`);
    const t = st.layout.text || "";
    result.oldRoutesGrown[route] = {
      url: page.url(),
      stillGated: t.includes("小龍還沒長大"),
      hasDeedWord: t.includes("事蹟"),
      hasMirrorWord: t.includes("鏡子"),
      hasAI: t.includes("AI"),
      hasSuibi: t.includes("隨筆"),
      snippet: t.slice(0, 500),
    };
    result.states.push(st);
  }

  // MCP endpoint after stage 2
  try {
    const mcp = await page.request.get("/mcp", { headers: { Accept: "text/event-stream" } });
    result.regressions.mcpStatus = mcp.status();
  } catch (e) {
    result.regressions.mcpError = String(e.message || e);
  }

  await ctx.close();

  const ctx2 = await browser.newContext({
    baseURL: BASE, viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    locale: "zh-TW", timezoneId: "Asia/Taipei", colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page2 = await ctx2.newPage();
  await page2.goto("/login", { waitUntil: "networkidle" });
  await page2.getByLabel("Email").fill(email);
  await page2.getByLabel("名字", { exact: true }).fill(player);
  await page2.getByRole("button", { name: "開發用登入" }).click();
  await page2.waitForTimeout(800);
  await page2.goto("/", { waitUntil: "networkidle" });
  result.reducedMotion.atHome = await page2.evaluate(() =>
    [...document.querySelectorAll(".outing-dot, .star-pop, .confetti span, .hatch-baby, .baby-hit.jump, .gesture-hint")]
      .map((el) => ({ cls: el.className, animation: getComputedStyle(el).animationName }))
  );
  await page2.screenshot({ path: path.join(OUT, `${vp.name}-23-reduced-motion-home.png`) });
  await ctx2.close();
  return result;
}

const report = { started: new Date().toISOString(), base: BASE, sha: process.env.VERIFY_SHA ?? "e6bc733", viewports: {} };
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const vp of VIEWPORTS) {
    console.log("==== running", vp.name);
    try {
      report.viewports[vp.name] = await runViewport(browser, vp);
      const v = report.viewports[vp.name];
      console.log("==== done", vp.name, "states", v.states.length, "errors", v.errors);
    } catch (err) {
      console.error("==== FAIL", vp.name, err);
      report.viewports[vp.name] = { fatal: String(err && err.stack || err) };
    }
  }
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
await writeFile(path.join(OUT, "journey-raw.json"), JSON.stringify(report, null, 2));
console.log("wrote", path.join(OUT, "journey-raw.json"));
