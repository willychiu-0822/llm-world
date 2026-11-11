import { expect } from "@playwright/test";
import { test } from "./helpers";
import { evidence, growToStageTwo, json, seedPredecessor } from "./helpers";

test("UAT-09 P2-4 音樂事蹟的預設第一步不誤掛到運動願望", async ({ page }) => {
  const source = await seedPredecessor();
  await json(page.request.post("/api/auth/dev-login", { data: { email: "cross-district@e2e.test" } }));
  await growToStageTwo(page);
  await json(page.request.post("/api/me/wants", { data: { text: "想慢跑", districtKey: "sports" } }));
  await page.goto(`/deeds/${source.id}`);
  await page.getByRole("link", { name: "我也想做", exact: true }).click();
  await expect(page.getByLabel("想做的事", { exact: true })).toHaveValue("");
  await expect(page.getByText(/完成後.*音樂坊/)).toBeVisible();
  await evidence(page, "UAT-09-music-default");
  await page.getByLabel("第一步", { exact: true }).fill("先在家唱一句");
  await page.getByRole("button", { name: "確定這一步" }).click();
  await page.getByRole("button", { name: "我做到了", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "先在家唱一句" }).getByRole("link", { name: "看看這件事" }).click();
  const deed = await json(page.request.get(`/api/deeds/${page.url().split("/").pop()}`));
  expect(deed.districtKey).toBe("music");
  expect(deed.placeId).toBe("pub_music");
  await evidence(page, "UAT-09-music-deed");
});

test("UAT-09b P2-4 手動改選另一區時說明與事蹟位置一致", async ({ page }) => {
  const source = await seedPredecessor();
  await json(page.request.post("/api/auth/dev-login", { data: { email: "explicit-district@e2e.test" } }));
  await growToStageTwo(page);
  const sports = await json(page.request.post("/api/me/wants", { data: { text: "想慢跑", districtKey: "sports" } }));
  const music = await json(page.request.post("/api/me/wants", { data: { text: "想唱歌", districtKey: "music" } }));
  await page.goto(`/steps/new?deedId=${source.id}`);
  await expect(page.getByLabel("想做的事", { exact: true })).toHaveValue(music.id);
  await page.getByLabel("想做的事", { exact: true }).selectOption(sports.id);
  await expect(page.getByText(/完成後.*運動場跑道/)).toBeVisible();
  await evidence(page, "UAT-09b-explicit-sports");
  await page.getByLabel("第一步", { exact: true }).fill("慢跑時試著哼歌");
  await page.getByRole("button", { name: "確定這一步" }).click();
  await page.getByRole("button", { name: "我做到了", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "慢跑時試著哼歌" }).getByRole("link", { name: "看看這件事" }).click();
  const deed = await json(page.request.get(`/api/deeds/${page.url().split("/").pop()}`));
  expect(deed.districtKey).toBe("sports");
  expect(deed.placeId).toBe("pub_sports");
});
