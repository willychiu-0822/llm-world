import { expect } from "@playwright/test";
import { test, evidence, json } from "./helpers";

test("UAT-20 隨筆儲存暫時失敗時保留內容，可重試而不產生未處理錯誤", async ({ page }) => {
  await json(page.request.post("/api/auth/dev-login", { data: { email: "note-retry@e2e.test", name: "想記下心情的新手" } }));
  const step = await json(page.request.post("/api/first-steps", { data: { executor: "self", text: "今天先唱一首歌" } }));
  await json(page.request.post(`/api/first-steps/${step.id}/complete`, { data: {} }));
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/steps");
  await page.getByRole("tab", { name: /完成了/ }).click();
  for (const [kind, label] of [["before", "做之前的隨筆"], ["after", "做之後的隨筆"]]) {
    let attempts = 0;
    await page.route(`**/api/first-steps/${step.id}/notes/${kind}`, async route => {
      if (++attempts === 1) return route.fulfill({ status: 503, json: { error: { code: "internal", message: "temporarily unavailable" } } });
      await route.continue();
    });
    await page.locator(`.${kind}`).getByRole("button", { name: "寫一點", exact: true }).click();
    const form = page.locator(`form.${kind}`);
    const note = `${label}：有點緊張，不過我想試試看。`;
    await form.getByLabel(label, { exact: true }).fill(note);
    const shared = kind === "after";
    await form.getByRole("checkbox").setChecked(shared);
    await form.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("還沒存好");
    await expect(form.getByLabel(label, { exact: true })).toHaveValue(note);
    await expect(form.getByRole("checkbox")).toBeChecked({ checked: shared });
    await evidence(page, `UAT-20-${kind}-retry`);
    await form.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(page.locator(`.${kind}`)).toContainText(note);
    const saved = await json(page.request.get("/api/first-steps"));
    expect(saved[0].notes[kind]).toMatchObject({ body: note, shared });
    expect(attempts).toBe(2);
    await evidence(page, `UAT-20-${kind}-saved`);
  }
  expect(errors).toEqual([]);
});
