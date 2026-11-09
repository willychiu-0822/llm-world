import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, json } from "./helpers";

test("UAT-08 P2-3 非管理者不呼叫管理 API 並能回到地圖", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "non-admin@e2e.test" } }));
  const adminRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/admin/")) adminRequests.push(r.url()); });
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/admin");
  await expect(page.getByText("需要管理者權限。", { exact: true })).toBeVisible();
  expect(adminRequests).toEqual([]);
  await evidence(page, "UAT-08-forbidden");
  await page.getByRole("link", { name: "回地圖", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(adminRequests).toEqual([]);
  expect(errors).toEqual([]);
});
