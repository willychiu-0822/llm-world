import { expect, test } from "@playwright/test";
import { json, loginPage, mcpConnect, tool } from "./helpers";

/**
 * 情境 C：經驗者 Mia
 * 自己完成第一步並分享隨筆 → 被相似的人發現、參考 → 收到回謝 → AI 代答（他人的 AI 讀到分享的隨筆）
 */
test("Mia shares her first step and is thanked when Kai follows it", async ({ browser }) => {
  const mia = await loginPage(browser, "mia2@e2e.test", "Mia");
  await mia.goto("/me/character");
  await mia.getByLabel("角色名字").fill("小雀");
  await mia.getByRole("button", { name: /^小花/ }).click();
  await mia.getByRole("button", { name: "儲存角色" }).click();
  await expect(mia.getByText("角色已儲存")).toBeVisible();
  await mia.getByLabel("想做的事", { exact: true }).fill("想做一個自己的杯子");
  await mia.getByLabel("主題區").selectOption("crafts");
  await mia.getByRole("button", { name: "寫下來" }).click();
  await expect(mia.getByText("想做一個自己的杯子")).toBeVisible();

  // Mia 自己的第一步
  await mia.goto("/steps/new");
  await mia.getByLabel("第一步").fill("去上一次陶藝體驗課");
  await mia.getByLabel(/做之前的隨筆/).fill("怕手很笨，在門口站了五分鐘才進去。");
  await mia.getByRole("button", { name: "確定這一步" }).click();
  await mia.waitForURL("**/steps");
  await mia.getByRole("button", { name: "我做到了" }).click();
  await mia.getByLabel("做之後的隨筆（選填）").fill("杯子歪了，但現在每天都用它喝水。");
  await mia.getByLabel("把這段隨筆分享到事蹟").check();
  await mia.getByRole("button", { name: "完成", exact: true }).click();
  await expect(mia.getByText("太好了！這成為你的新事蹟")).toBeVisible();

  // 也分享「做之前」的擔心
  await mia.getByRole("tab", { name: /完成了/ }).click();
  await mia.getByRole("button", { name: "編輯" }).first().click();
  await mia.getByLabel("分享到事蹟，讓後來的人看到").check();
  await mia.getByRole("button", { name: "儲存" }).click();
  await mia.getByRole("link", { name: "看看這個事蹟" }).click();
  const deedUrl = mia.url();
  await expect(mia.getByText("還沒有人參考這一步")).toBeVisible();

  // 小凱在手作巷發現 Mia 的事蹟
  const kai = await loginPage(browser, "kai@e2e.test", "小凱");
  await kai.goto("/me/character");
  await kai.getByLabel("角色名字").fill("凱凱");
  await kai.getByRole("button", { name: "儲存角色" }).click();
  await expect(kai.getByText("角色已儲存")).toBeVisible();
  await kai.goto("/");
  await kai.getByRole("link", { name: /手作巷長椅/ }).click();
  await kai.getByRole("link", { name: /去上一次陶藝體驗課/ }).click();
  await expect(kai.getByText("怕手很笨，在門口站了五分鐘才進去。")).toBeVisible();
  await expect(kai.getByText("杯子歪了，但現在每天都用它喝水。")).toBeVisible();

  // 小凱的 AI 讀到 Mia 分享的經驗（AI 代答）
  const ai = await mcpConnect(kai);
  const deedId = deedUrl.split("/").pop()!;
  const viaAi = await tool(ai, "deed_get", { deedId });
  expect(viaAi.sharedNotes).toEqual({ before: "怕手很笨，在門口站了五分鐘才進去。", after: "杯子歪了，但現在每天都用它喝水。" });
  expect(JSON.stringify(viaAi)).not.toContain("mia2@e2e.test");
  await ai.close();

  // 小凱參考 Mia 的第一步
  await kai.goto(`/deeds/${deedId}`);
  await kai.getByRole("link", { name: "我也想做" }).click();
  await expect(kai.getByRole("button", { name: "已參考" })).toBeVisible();
  await kai.getByLabel("第一步").fill("先去捏土小屋看看");
  await kai.getByRole("button", { name: "確定這一步" }).click();
  await kai.waitForURL("**/steps");

  // Mia 收到回謝（只有她看得到數字）
  await mia.goto("/notifications");
  await expect(mia.getByText("有人參考了你的第一步「去上一次陶藝體驗課」，正準備去做。")).toBeVisible();
  await mia.goto(deedUrl);
  await expect(mia.getByText("有 1 個人參考了你的第一步，其中 0 個人也做到了。")).toBeVisible();

  // 小凱也做到了
  await kai.getByRole("button", { name: "我做到了" }).click();
  await kai.getByRole("button", { name: "完成", exact: true }).click();
  await expect(kai.getByText("太好了！這成為你的新事蹟")).toBeVisible();
  await mia.reload();
  await expect(mia.getByText("有 1 個人參考了你的第一步，其中 1 個人也做到了。")).toBeVisible();
  await mia.goto("/mirror");
  await expect(mia.getByText(/有 1 個人參考了你的經驗，其中 1 個人也做到了/)).toBeVisible();

  // 別人看不到回謝數字
  await kai.goto(deedUrl);
  await expect(kai.getByText(/個人參考了你的第一步/)).toHaveCount(0);

  // Mia 改成私人後，別人就看不到了
  await mia.goto(deedUrl);
  await mia.getByRole("button", { name: "改成私人" }).click();
  await expect(mia.getByText("目前：私人")).toBeVisible();
  await kai.goto(deedUrl);
  await expect(kai.getByRole("alert")).toHaveText("找不到這個內容");
  expect(await json(kai.request.get("/api/me"))).toBeTruthy();
});
