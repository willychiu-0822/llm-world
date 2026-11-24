import { expect } from "@playwright/test";
import { test } from "./helpers";
import { json, loginPage, look, mcpConnect, panToPlace, tool } from "./helpers";

test("G9 開關串門會改變遇見的人", async ({ browser }) => {
  const home = await loginPage(browser, "visit-home@e2e.test", "主人");
  await json(home.request.put("/api/me/character", { data: { name: "我家小龍", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await home.goto("/life");
  await home.getByRole("button", { name: "陪牠去玩" }).click();
  await home.getByRole("radio", { name: /去朋友家喝茶/ }).click();
  await expect(home.getByText("小栗在家等著，茶都泡好了。")).toBeVisible();
  await home.getByRole("button", { name: "先待在家" }).click();

  const friend = await loginPage(browser, "visit-friend@e2e.test", "朋友");
  await json(friend.request.put("/api/me/character", { data: { name: "阿綠", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: false } } }));
  await friend.goto("/life");
  await expect(friend.getByRole("region", { name: "串門子" })).toContainText("小龍先待在家，不去串門。");
  await friend.getByRole("button", { name: "讓小龍去串門" }).click();
  await expect(friend.getByText("小龍會去朋友家串門，也可能被別的小龍遇到。別人只看得到名字和長相。")).toBeVisible();

  await home.goto("/life");
  await home.getByRole("button", { name: "陪牠去玩" }).click();
  await home.getByRole("radio", { name: /去朋友家喝茶/ }).click();
  await expect(home.getByText("在小栗家碰到「阿綠」的小龍，一起喝了茶。")).toBeVisible();
  const met = await json(home.request.get("/api/me/life"));
  expect(Object.keys(met.encounter).sort()).toEqual(["appearance", "kind", "name"]);
  expect(JSON.stringify(met)).not.toContain("visit-friend@e2e.test");

  await friend.goto("/life");
  await friend.getByRole("button", { name: "陪牠去玩" }).click();
  await friend.getByRole("radio", { name: /去朋友家喝茶/ }).click();
  await expect(friend.getByText("小栗在家等著，茶都泡好了。")).toBeVisible();
  await friend.getByRole("button", { name: "先待在家" }).click();
  await friend.getByRole("button", { name: "先不串門" }).click();
  await expect(friend.getByText("小龍先待在家，不去串門。")).toBeVisible();

  await home.goto("/life");
  await home.getByRole("button", { name: "陪牠去玩" }).click();
  await home.getByRole("radio", { name: /去朋友家喝茶/ }).click();
  await expect(home.getByText("小栗在家等著，茶都泡好了。")).toBeVisible();
});

test("G10 地圖走到地點、打開信物、接下", async ({ browser }) => {
  const mia = await loginPage(browser, "g10-mia@e2e.test", "Mia");
  await json(mia.request.put("/api/me/character", { data: { name: "小雀", appearance: look("flower"), personality: "", sharing: { allowAiQuotes: true } } }));
  const want = await json(mia.request.post("/api/me/wants", { data: { text: "想做杯子", districtKey: "crafts" } }));
  const step = await json(mia.request.post("/api/first-steps", { data: { executor: "self", text: "去上一次陶藝體驗課", wantId: want.id } }));
  await json(mia.request.post(`/api/first-steps/${step.id}/complete`, { data: { visibility: "public", noteAfter: "只有我知道的私事", noteShared: false } }));
  const hidden = await json(mia.request.post("/api/first-steps", { data: { executor: "self", text: "這件私密的陶藝不能被看到", wantId: want.id } }));
  await json(mia.request.post(`/api/first-steps/${hidden.id}/complete`, { data: { visibility: "private" } }));

  const kai = await loginPage(browser, "g10-kai@e2e.test", "小凱");
  await json(kai.request.put("/api/me/character", { data: { name: "凱凱", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await kai.goto("/map");
  await panToPlace(kai, /手作巷長椅/);
  await kai.getByRole("link", { name: /手作巷長椅/ }).click();
  await expect(kai.getByRole("heading", { name: "手作巷長椅" })).toBeVisible();
  await expect(kai.getByText("這件私密的陶藝不能被看到")).toHaveCount(0);
  await expect(kai.getByText("只有我知道的私事")).toHaveCount(0);
  await kai.getByRole("button", { name: "看看這顆信物" }).click();
  const dialog = kai.getByRole("dialog");
  await expect(dialog).toContainText("去上一次陶藝體驗課");
  await dialog.getByRole("button", { name: "我也去摸摸看" }).click();
  await expect(kai.getByText("我幫你記著喔。")).toBeVisible();
  await expect(kai.getByRole("button", { name: "我做到了！" })).toBeVisible();
});

test("G11 life_get 只讀、不寫、不帶別人", async ({ browser }) => {
  const other = await loginPage(browser, "g11-other@e2e.test", "別人");
  await json(other.request.put("/api/me/character", { data: { name: "路過的小綠", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await json(other.request.patch("/api/me/life", { data: { allowVisits: true } }));

  const page = await loginPage(browser, "g11-me@e2e.test", "小米");
  await json(page.request.put("/api/me/character", { data: { name: "小米", appearance: look(), personality: "", sharing: { allowAiQuotes: false } } }));
  await json(page.request.post("/api/me/life/activities", { data: { activityId: "music" } }));
  const before = await json(page.request.get("/api/me"));
  const lifeBefore = await json(page.request.get("/api/me/life"));

  const ai = await mcpConnect(page);
  const listed = await ai.listTools();
  expect(listed.tools.find((t) => t.name === "life_get")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  const data = await tool(ai, "life_get");
  expect(data.note).toContain("虛構");
  const text = JSON.stringify(data);
  expect(text).not.toContain("路過的小綠");
  expect(text).not.toContain("g11-other@e2e.test");
  expect(text).not.toContain("g11-me@e2e.test");
  await ai.close();

  const after = await json(page.request.get("/api/me"));
  const lifeAfter = await json(page.request.get("/api/me/life"));
  expect(after.pet.stars).toBe(before.pet.stars);
  expect(lifeAfter.today).toEqual(lifeBefore.today);
  expect(lifeAfter.inventory).toEqual(lifeBefore.inventory);
});
