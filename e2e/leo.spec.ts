import { expect } from "@playwright/test";
import { test } from "./helpers";
import { json, loginPage, look } from "./helpers";

/**
 * 情境 B：活動推廣者 Leo
 * 申請 → 管理者核准 → 開店 → 上架試用機會（FAQ、場次）→ 有人報名 → 確認出席 → 收到隨筆與需求訊號
 */
test("Leo opens a shop, publishes a trial, confirms attendance and sees thanks", async ({ browser }) => {
  // ① 建立：申請成為提供者
  const leo = await loginPage(browser, "leo@e2e.test", "Leo");
  await leo.goto("/provider");
  await leo.getByLabel("提供者名稱").fill("Leo 的新手慢跑");
  await leo.getByLabel("提供者介紹").fill("每週日帶新手慢跑，走跑交替也沒關係。");
  await leo.getByRole("button", { name: "送出申請" }).click();
  await expect(leo.getByText("申請審核中")).toBeVisible();

  // 管理者核准
  const admin = await loginPage(browser, "admin@e2e.test", "管理者");
  await admin.goto("/admin");
  const row = admin.getByRole("row", { name: /Leo 的新手慢跑/ });
  await row.getByRole("button", { name: "核准" }).click();
  await expect(row.getByText("approved")).toBeVisible();

  // 開店、上架試用機會
  await leo.goto("/provider");
  await expect(leo.getByRole("heading", { name: "Leo 的新手慢跑" })).toBeVisible();
  await leo.getByLabel("店的主題區").selectOption("sports");
  await leo.getByLabel("店名").fill("Leo 慢跑站");
  await leo.getByLabel("實際地址").fill("台北市河濱公園入口");
  await leo.getByRole("button", { name: "開店" }).click();
  await expect(leo.getByText("台北市河濱公園入口")).toBeVisible();

  await leo.getByLabel("試用機會名稱").fill("新手 5K 慢跑");
  await leo.getByLabel("時長（分鐘）").fill("60");
  await leo.getByLabel("時間說明").fill("每週日 07:00");
  await leo.getByLabel("過程資訊").fill("前 10 分鐘只做暖身；大約一半的人是第一次跑；最慢的人由我陪跑。");
  await leo.getByLabel("建議的 AI 第一步").fill("來問 Leo 的 agent 任何問題");
  await leo.getByLabel("建議的本人第一步").fill("報名這週日的慢跑");
  await leo.getByRole("button", { name: "上架" }).click();
  await expect(leo.getByRole("heading", { name: "新手 5K 慢跑" })).toBeVisible();

  await leo.getByLabel("問題").fill("跟不上怎麼辦？");
  await leo.getByLabel("回答").fill("可以走跑交替，我會陪最後一位。");
  await leo.getByRole("button", { name: "新增問答" }).click();
  await expect(leo.getByText("Q：跟不上怎麼辦？")).toBeVisible();
  await leo.getByLabel("場次時間").fill("2030-11-10T07:00");
  await leo.getByLabel("名額").fill("10");
  await leo.getByRole("button", { name: "新增場次" }).click();
  await expect(leo.getByText(/（0\/10 人）/)).toBeVisible();

  // ② 被發現：店出現在龍角鎮地圖的運動場
  const runner = await loginPage(browser, "runner@e2e.test", "跑者");
  await json(runner.request.put("/api/me/character", { data: { name: "小跑", appearance: look(), personality: "", sharing: { allowAiQuotes: true } } }));
  await runner.goto("/map");
  await runner.getByRole("link", { name: /Leo 慢跑站/ }).click();
  await expect(runner.getByRole("heading", { name: "Leo 慢跑站" })).toBeVisible();
  await runner.getByRole("link", { name: /新手 5K 慢跑/ }).click();
  await expect(runner.getByText("Q：跟不上怎麼辦？")).toBeVisible();
  await expect(runner.getByText("📍 台北市河濱公園入口")).toBeVisible();

  // ③ 讓人參與：報名（本人第一步）
  await runner.getByRole("link", { name: "我也想試試" }).click();
  await expect(runner.getByText("提供者建議的第一步")).toBeVisible();
  await runner.getByLabel("報名場次").selectOption({ index: 1 });
  await runner.getByLabel("第一步").fill("週日去跑新手 5K");
  await runner.getByLabel(/做之前的隨筆/).fill("我連 1 公里都沒跑過。");
  await runner.getByRole("button", { name: "確定這一步" }).click();
  await runner.waitForURL("**/steps");
  await expect(runner.getByRole("heading", { name: "「週日去跑新手 5K」" })).toBeVisible();
  await expect(runner.getByRole("link", { name: "加入行事曆" })).toHaveAttribute("href", /\/ics$/);

  // ④⑤ 準備、進行：Leo 看到報名名單並確認出席
  await leo.reload();
  await leo.getByRole("button", { name: "報名名單" }).click();
  await expect(leo.getByText("小跑")).toBeVisible();
  await leo.getByRole("button", { name: "確認出席" }).click();
  await expect(leo.getByText("已出席")).toBeVisible();

  // ⑥ 結束：參加者收到通知、寫下做後隨筆並分享
  await runner.goto("/notifications");
  await expect(runner.getByText(/新手 5K 慢跑」確認了你的出席/)).toBeVisible();
  await runner.goto("/steps");
  await runner.getByRole("tab", { name: /完成了/ }).click();
  await expect(runner.getByText("提供者已確認出席")).toBeVisible();
  await runner.getByRole("button", { name: "寫一點" }).click();
  await runner.getByLabel("做之後的隨筆").fill("走了一半的路，但教練一直陪著最後一個人。");
  await runner.getByLabel("分享到事蹟，讓後來的人看到").check();
  await runner.getByRole("button", { name: "儲存" }).click();
  await expect(runner.getByText("走了一半的路，但教練一直陪著最後一個人。")).toBeVisible();

  // Leo 收到回謝與需求訊號
  await leo.reload();
  await expect(leo.getByText("出席 1")).toBeVisible();
  await expect(leo.getByText("走了一半的路，但教練一直陪著最後一個人。")).toBeVisible();
});
