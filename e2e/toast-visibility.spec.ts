import { expect } from "@playwright/test";
import { test, json, growToStageTwo } from "./helpers";

test("A6 提示可關閉且不遮住操作", async ({page}) => {
  await json(page.request.post("/api/auth/dev-login", {data: {email: `toast-${test.info().project.name}@e2e.test`}}));
  await growToStageTwo(page);
  await page.goto("/steps/new");
  await page.getByLabel("第一步").fill("去聽一首歌");
  await page.getByRole("button", {name:"確定這一步"}).click();
  await expect(page.locator(".toast")).toBeVisible();
  await expect(page.locator(".toast").getByRole("button", {name:"關閉提示"})).toBeVisible();
  const covered = await page.evaluate(() => {
    const toast = document.querySelector(".toast")!.getBoundingClientRect();
    return [...document.querySelectorAll("button, a, input, textarea, select")].filter(el => !el.closest(".toast")).flatMap(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      if (s.visibility === "hidden" || s.display === "none" || r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= innerHeight) return [];
      return r.left < toast.right && r.right > toast.left && r.top < toast.bottom && r.bottom > toast.top ? [(el as HTMLElement).innerText || el.getAttribute("aria-label") || el.tagName] : [];
    });
  });
  expect(covered).toEqual([]);
  await page.screenshot({ path: `docs/uat/evidence/${test.info().project.name}-A6-notice.png` });
  await page.locator(".toast").getByRole("button", {name:"關閉提示"}).click();
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("A6 連接頁複製提示可見、不遮擋按鈕", async ({page, context}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await json(page.request.post("/api/auth/dev-login", {data: {email: `toast-connect-${test.info().project.name}@e2e.test`}}));
  await growToStageTwo(page);
  await page.goto("/connect");
  await page.getByRole("button", {name:"開始連接"}).click();
  for (const [name, message] of [["複製", "網址已複製"], ["複製這兩行", "指令已複製"]]) {
    await page.getByRole("button", {name, exact:true}).click();
    const notice = page.locator(".toast");
    await expect(notice).toContainText(message);
    await expect(notice).toBeInViewport({ratio:1});
    expect(await notice.evaluate(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    })).toBe(true);
    expect(await notice.evaluate(el => {
      const noticeRect = el.getBoundingClientRect();
      return [...document.querySelectorAll("button, a, input, textarea, select")].filter(target => {
        if (el.contains(target)) return false;
        const style = getComputedStyle(target), rect = target.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 &&
          rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth &&
          rect.left < noticeRect.right && rect.right > noticeRect.left && rect.top < noticeRect.bottom && rect.bottom > noticeRect.top;
      }).map(target => target.textContent?.trim() || target.tagName);
    })).toEqual([]);
    await page.screenshot({path:`docs/uat/evidence/${test.info().project.name}-A6-${name === "複製" ? "copy-url" : "copy-codex"}.png`});
    await notice.getByRole("button", {name:"關閉提示"}).click();
    await expect(notice).toHaveCount(0);
  }
});
