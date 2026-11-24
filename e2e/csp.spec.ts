import { expect } from "@playwright/test";
import { mcpConnect, test } from "./helpers";

test("LW-17 頁面帶嚴格 CSP，首頁、設定、地圖與同意頁都沒有違規", async ({ page }) => {
  const violations: string[] = [];
  await page.exposeBinding("cspReport", (_source, text: string) => {
    violations.push(text);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      void (window as unknown as { cspReport: (text: string) => void }).cspReport(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  page.on("console", (message) => {
    if (/content security policy|violates the following/i.test(message.text()))
      violations.push(message.text());
  });

  const home = await page.goto("/");
  expect(home?.headers()["content-security-policy"] ?? "").toContain("default-src 'self'");
  await expect(page.getByRole("heading", { name: "龍角鎮", exact: true })).toBeVisible();
  await expect(page.locator(".town-svg")).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill("csp@e2e.test");
  await page.getByLabel("名字", { exact: true }).fill("檢查安全的新手");
  await page.getByRole("button", { name: "開發用登入" }).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByRole("link", { name: "把牠撿回家", exact: true })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "地圖", exact: true })).toBeVisible();
  await expect(page.locator(".town-svg")).toBeVisible();

  const ai = await mcpConnect(page);
  await ai.close();
  expect(violations).toEqual([]);
});
