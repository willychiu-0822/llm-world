// G9 串門同意、G10 鎮民的心意（地圖→地點→信物→接下）、G11 life_get 唯讀。
import { expect } from "@playwright/test";
import pg from "pg";
import { LIFE_ACTIVITIES } from "../packages/core/src/life";
import { assertE2eDatabase } from "./assert-e2e-database.mjs";
import { apiAs, json, loginPage, look, mcpConnect, panToPlace, test, tool } from "./helpers";

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/longjiao_laned_e2e";

/** 讓「串門」成為今天唯一開的地方：其他六種都已經帶回家過（日期是舊的）。 */
async function onlyVisitOpen(email: string) {
  assertE2eDatabase(DB_URL);
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  try {
    const inventory = LIFE_ACTIVITIES.filter(a => a.id !== "visit").map(a => ({ activityId: a.id, earnedOn: "2020-01-01" }));
    const r = await db.query(
      `UPDATE characters SET sharing = jsonb_set(sharing, '{life}', COALESCE(sharing->'life', '{"version":1,"days":[]}'::jsonb) || jsonb_build_object('inventory', $1::jsonb)) WHERE user_id = (SELECT id FROM users WHERE email = $2)`,
      [JSON.stringify(inventory), email]);
    expect(r.rowCount).toBe(1);
  } finally { await db.end(); }
}

test("G9：串門要玩家自己同意，開關之後別人遇到的對象會跟著變", async ({ browser }) => {
  const me = await loginPage(browser, "g9-me@e2e.test", "G9我");
  await json(me.request.put("/api/me/character", { data: { name: "我家小龍", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await onlyVisitOpen("g9-me@e2e.test");
  const friend = await loginPage(browser, "g9-friend@e2e.test", "G9朋友");
  await json(friend.request.put("/api/me/character", { data: { name: "阿綠", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: false } } }));

  const openVisit = async () => {
    await me.goto("/life");
    await me.getByRole("button", { name: "陪牠去玩", exact: true }).click();
    const visit = me.getByRole("radio", { name: /去朋友家喝茶/ });
    await expect(visit).toBeEnabled();
    await visit.click();
  };

  // 預設沒有人同意，只會遇到鎮上的小栗
  await openVisit();
  await expect(me.getByText("小栗在家等著")).toBeVisible();
  await expect(me.getByText("阿綠")).toHaveCount(0);

  // 朋友自己按下「讓小龍去串門」
  await friend.goto("/life");
  await expect(friend.getByText("小龍先待在家，不去串門。")).toBeVisible();
  await friend.getByRole("button", { name: "讓小龍去串門" }).click();
  await expect(friend.getByRole("button", { name: "先不串門" })).toBeVisible();

  // 我這邊現在會遇到「阿綠」，而且只看得到名字和長相
  await openVisit();
  await expect(me.getByText("碰到「阿綠」的小龍")).toBeVisible();
  const seen = await json(me.request.get("/api/me/life"));
  expect(Object.keys(seen.encounter).sort()).toEqual(["appearance", "kind", "name"]);
  expect(JSON.stringify(seen)).not.toContain("g9-friend@e2e.test");
  // 朋友自己不會遇到自己
  expect((await json(friend.request.get("/api/me/life"))).encounter.kind).toBe("town");

  // 朋友收回同意，我這邊回到小栗
  await friend.getByRole("button", { name: "先不串門" }).click();
  await expect(friend.getByRole("button", { name: "讓小龍去串門" })).toBeVisible();
  await openVisit();
  await expect(me.getByText("小栗在家等著")).toBeVisible();
  await expect(me.getByText("阿綠")).toHaveCount(0);
  await me.getByRole("button", { name: "就去這裡" }).click();
  await expect(me.locator(".life-meeting")).toContainText("小栗在家等著");
});

test("G10：地圖→地點→信物→接下，鎮民的心意只露出公開的內容", async ({ browser }) => {
  const mia = await apiAs("g10-mia@e2e.test", "Mia");
  await json(mia.put("/api/me/character", { data: { name: "小雀", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: true } } }));
  const want = await json(mia.post("/api/me/wants", { data: { text: "想去學唱歌", districtKey: "music" } }));
  const step = await json(mia.post("/api/first-steps", { data: { executor: "self", text: "去上一次聲樂體驗課", wantId: want.id } }));
  const done = await json(mia.post(`/api/first-steps/${step.id}/complete`, { data: { noteAfter: "聲音抖抖的，老師說這樣剛好。", noteShared: true } }));
  const priv = await json(mia.post("/api/first-steps", { data: { executor: "self", text: "只有我知道的私事 Z9" } }));
  await json(mia.post(`/api/first-steps/${priv.id}/complete`, { data: { visibility: "private" } }));

  const kai = await loginPage(browser, "g10-kai@e2e.test", "小凱");
  await json(kai.request.put("/api/me/character", { data: { name: "凱凱", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await kai.goto("/life");
  const heart = kai.getByLabel("鎮民的心意");
  await expect(heart).toContainText("小雀留下一份心意：「去上一次聲樂體驗課」");
  await expect(heart).not.toContainText("Z9");
  await expect(heart.getByRole("link", { name: "去看看這份心意" })).toBeVisible();
  const placeName: string = (await json(kai.request.get("/api/me/life"))).inspiration.placeName;
  expect(JSON.stringify(await json(kai.request.get("/api/me/life")))).not.toContain("g10-mia@e2e.test");

  const mapLink = new RegExp(`^${placeName}（`); // 地圖上的建築（aria-label 帶信物數），不是上方的「去…」按鈕
  // 從地圖走到那個地方，打開信物，接下
  await kai.goto("/map");
  await panToPlace(kai, mapLink);
  await kai.getByRole("link", { name: mapLink }).click();
  await expect(kai.getByRole("heading", { name: "留下的信物" })).toBeVisible();
  await expect(kai.getByText("Z9")).toHaveCount(0);
  await kai.getByRole("button", { name: /去上一次聲樂體驗課/ }).click();
  await expect(kai.getByRole("dialog")).toContainText("去上一次聲樂體驗課");
  // 還沒長大的小龍只看得到那句暖暖的話，看不到完整分享
  await expect(kai.getByRole("dialog").getByRole("link", { name: "看看完整分享" })).toHaveCount(0);
  await expect(kai.getByRole("dialog")).not.toContainText("聲音抖抖的");
  await kai.getByRole("button", { name: "我也去摸摸看" }).click();
  await expect(kai.getByText("我幫你記著喔。")).toBeVisible();
  await expect(kai.getByRole("button", { name: "我做到了！" })).toBeVisible();

  // Mia 把這則改成私密，心意馬上不見
  await json(mia.patch(`/api/deeds/${done.deed.id}`, { data: { visibility: "private" } }));
  await kai.goto("/life");
  await expect(kai.getByLabel("鎮民的心意")).toContainText("鎮上還沒有人留下新的心意");
});

test("G11：life_get 只讀小龍自己的小日子，不寫入、不含別人的資料", async ({ browser }) => {
  const other = await loginPage(browser, "g11-other@e2e.test", "路過的小綠");
  await json(other.request.put("/api/me/character", { data: { name: "路過的小綠", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await json(other.request.patch("/api/me/life", { data: { allowVisits: true } }));
  const me = await loginPage(browser, "g11-me@e2e.test", "G11我");
  await json(me.request.put("/api/me/character", { data: { name: "小米", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  const life = await json(me.request.get("/api/me/life"));
  const open = life.activities.filter((a: { open: boolean }) => a.open);
  const played = open[0];
  await json(me.request.post("/api/me/life/activities", { data: { activityId: played.id } }));

  const before = await json(me.request.get("/api/me/life"));
  const starsBefore = (await json(me.request.get("/api/me"))).pet.stars;
  const ai = await mcpConnect(me);
  const listed = (await ai.listTools()).tools.find(t => t.name === "life_get")!;
  expect(listed.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
  const res = await tool(ai, "life_get");
  await ai.close();

  expect(res.note).toContain("虛構");
  expect(res.today.doneToday).toMatchObject([{ name: played.name, reward: played.reward }]);
  expect(res.today.canStillDo).toHaveLength(open.length - 1);
  expect(res.collection).toEqual({ owned: [played.reward], total: LIFE_ACTIVITIES.length });
  const text = JSON.stringify(res);
  for (const leak of ["路過的小綠", "g11-other@e2e.test", "g11-me@e2e.test", "encounter", "allowVisits", "inspiration"]) expect(text).not.toContain(leak);

  // 讀完之後什麼都沒變
  expect(await json(me.request.get("/api/me/life"))).toEqual(before);
  expect((await json(me.request.get("/api/me"))).pet.stars).toBe(starsBefore);
});
