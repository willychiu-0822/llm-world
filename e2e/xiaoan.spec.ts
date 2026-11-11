import { expect } from "@playwright/test";
import { test } from "./helpers";
import { apiAs, approvedProvider, growToStageTwo, json, loginPage, look, mcpConnect, tool } from "./helpers";

/**
 * 情境 A：用戶小安（內向、想唱歌）與角色 Nova
 * ① 設定 → ② AI 發現 → ③ 查看 → ④ 也想做 → ⑤ 定義第一步（AI）→ ⑥ AI 執行 → ⑦ 紀錄 → ⑧ 新事蹟
 * → ⑨ 繼續 → ⑤ 第一步（本人：報名試用課）→ 出席 → 隨筆 → 鏡子
 */
test("Xiaoan's loop: AI step first, then going to the trial in person", async ({ browser }) => {
  // 鎮上已有：Mia 的真人事蹟、聲樂教室的試用機會
  const mia = await apiAs("mia@e2e.test", "Mia");
  await json(mia.put("/api/me/character", { data: { name: "Mia 的小鳥", appearance: look("flower"), personality: "害羞", sharing: { allowAiQuotes: true } } }));
  const mw = await json(mia.post("/api/me/wants", { data: { text: "想唱歌", districtKey: "music" } }));
  const ms = await json(mia.post("/api/first-steps", { data: { executor: "self", text: "去上一次聲樂試用課", wantId: mw.id } }));
  const miaDeed = (await json(mia.post(`/api/first-steps/${ms.id}/complete`, { data: { noteAfter: "老師說大家第一次都會破音", noteShared: true } }))).deed;
  const voice = await approvedProvider(
    "voice@e2e.test",
    "小樹聲樂教室",
    { districtKey: "music", name: "小樹聲樂教室", realAddress: "台北市音樂路 1 號" },
    { title: "第一次聲樂試用課", whenText: "每週六 10:00", processInfo: "前十分鐘練呼吸，接著唱音階，最後選一首熟悉的歌。", aiFirstStepHint: "請角色來問老師任何問題", selfFirstStepHint: "報名這週六的試用課" },
    [{ question: "完全不會唱也可以嗎？", answer: "可以，大部分人第一次都會破音。" }],
    "2030-11-09T10:00:00+08:00",
  );

  const page = await loginPage(browser, "xiaoan@e2e.test", "小安");
  await growToStageTwo(page, "Nova");
  await json(page.request.put("/api/me/character", { data: { name: "Nova", appearance: { ...look(), description: "背著吉他的街頭歌手" }, personality: "外向、喜歡站上舞台", sharing: { allowAiQuotes: true } } }));
  await json(page.request.post("/api/me/wants", { data: { text: "想在別人面前唱一首歌", districtKey: "music" } }));

  // 連接 AI（OAuth 同意頁）
  await page.goto("/connect");
  await page.locator("details.advanced summary").click();
  await expect(page.locator("code", { hasText: "/mcp" })).toBeVisible();
  const ai = await mcpConnect(page);

  // ② AI 角色有所發現
  const me = await tool(ai, "character_get");
  expect(me.character.name).toBe("Nova");
  const found = await tool(ai, "world_discover");
  const ids = found.items.map((i: { id: string }) => i.id);
  expect(ids).toContain(miaDeed.id);
  expect(ids).toContain(voice.trial.id);
  const deed = await tool(ai, "deed_get", { deedId: miaDeed.id });
  expect(deed.sharedNotes.after).toBe("老師說大家第一次都會破音");
  await tool(ai, "trial_get", { trialId: voice.trial.id });
  await tool(ai, "discovery_bring_back", {
    message: "我在音樂坊遇到 Mia，她說第一次大家都會破音！附近還有一間聲樂教室有試用課。",
    items: [{ type: "deed", id: miaDeed.id }, { type: "trial", id: voice.trial.id }],
  });

  // ③ 查看發現
  await page.goto("/discoveries");
  await expect(page.getByText("我在音樂坊遇到 Mia")).toBeVisible();
  await expect(page.getByText("「去上一次聲樂試用課」")).toBeVisible();
  await expect(page.getByText("「第一次聲樂試用課」")).toBeVisible();

  // ④⑤ 也想做 → AI 建議第一步，本人確認
  const want = me.wants[0];
  await tool(ai, "first_step_propose", { executor: "ai", text: "Nova 去問老師試用課的流程", wantId: want.id, sourceDeedIds: [miaDeed.id], trialId: voice.trial.id, reason: "先知道會發生什麼，比較不怕" });
  await page.goto("/steps");
  await page.getByRole("tab", { name: /朋友的建議/ }).click();
  await expect(page.getByText("AI 的理由：先知道會發生什麼，比較不怕")).toBeVisible();
  await page.getByRole("button", { name: "確認這一步" }).click();
  await expect(page.getByText("這一步成立了")).toBeVisible();

  // ⑥ AI 執行：查 FAQ、轉問提供者、回報
  const todo = await tool(ai, "first_step_list");
  expect(todo).toHaveLength(1);
  const faq = await tool(ai, "provider_ask", { trialId: voice.trial.id, question: "完全不會唱可以嗎", stepId: todo[0].id });
  expect(faq.answered).toBe(true);
  const fwd = await tool(ai, "provider_ask", { trialId: voice.trial.id, question: "可以只在旁邊聽嗎？", stepId: todo[0].id });
  expect(fwd.answered).toBe(false);
  const pending = await tool(ai, "first_step_complete", { stepId: todo[0].id, result: "前十分鐘練呼吸、接著唱音階、最後選一首熟悉的歌。完全不會唱也可以，大部分人第一次都會破音。" });
  expect(pending.status).toBe("pending_review");

  // ⑦⑧ 先看過，再公開，才成為事蹟（執行者：AI 角色）
  await page.goto("/notifications");
  const notice = page.getByRole("link", { name: /等你看過/ });
  await expect(notice).toBeVisible();
  await notice.click();
  await expect(page).toHaveURL(/\/steps\?tab=review/);
  await page.getByRole("button", { name: "公開到鎮上" }).click();
  await expect(page.getByRole("status")).toContainText("已公開到鎮上");
  await page.getByRole("article").filter({ hasText: "Nova 去問老師試用課的流程" }).getByRole("link", { name: "看看這件事" }).click();
  await expect(page).toHaveURL(/\/deeds\/deed_/);
  await expect(page.getByText("朋友做的", { exact: true })).toBeVisible();
  await expect(page.getByText("真人做過", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/前十分鐘練呼吸/)).toBeVisible();

  // 提供者回答轉來的問題 → 小安收到通知
  const qs = await json(voice.api.get("/api/provider/questions"));
  await json(voice.api.post(`/api/provider/questions/${qs[0].id}/answer`, { data: { answer: "可以，第一次只聽也沒關係。", addToFaq: true } }));
  await page.goto("/notifications");
  await expect(page.getByText(/回答了你的 AI 問的問題/)).toBeVisible();

  // ⑨ → ⑤ 第二輪：本人報名試用課
  await page.goto(`/trials/${voice.trial.id}`);
  await page.getByRole("link", { name: "我也想試試" }).click();
  await page.getByLabel("報名場次").selectOption({ index: 1 });
  await page.getByLabel("第一步").fill("週六 10:00 去上試用課");
  await page.getByLabel(/做之前的話/).fill("應該會很尷尬吧，萬一破音怎麼辦……");
  await page.getByRole("button", { name: "確定這一步" }).click();
  await page.waitForURL("**/steps");

  // 提供者確認出席 → 自動紀錄
  const sessionBookings = await json(voice.api.get(`/api/provider/sessions/${voice.session.id}/bookings`));
  expect(sessionBookings[0].characterName).toBe("Nova");
  await json(voice.api.post(`/api/provider/bookings/${sessionBookings[0].id}/attend`));

  await page.goto("/steps");
  await page.getByRole("tab", { name: /完成了/ }).click();
  const item = page.getByRole("listitem").filter({ hasText: "週六 10:00 去上試用課" });
  await item.getByRole("button", { name: "寫一點" }).click();
  await item.getByLabel("做之後的話").fill("其實沒破音，老師說我的低音很特別。根本沒人在看我。");
  await item.getByLabel("說給後來的人聽").check();
  await item.getByRole("button", { name: "儲存" }).click();

  // 成就鏡子
  await page.goto("/mirror");
  await expect(page.getByText("已經有 2 步成真")).toBeVisible();
  await expect(page.getByText("應該會很尷尬吧，萬一破音怎麼辦……")).toBeVisible();
  await expect(page.getByText("其實沒破音，老師說我的低音很特別。根本沒人在看我。")).toBeVisible();
  await expect(page.getByRole("link", { name: /小樹聲樂教室/ })).toBeVisible();

  // Mia 收到回謝
  const miaNotes = await json(mia.get("/api/notifications"));
  expect(miaNotes.map((n: { kind: string }) => n.kind)).toContain("followed_completed");
  await ai.close();
});
