import { describe, expect, it, vi } from "vitest";
import { characters, deeds, lifeDays, lifeItems } from "@lj/db";
import { eq } from "drizzle-orm";
import { nova, userWithCharacter, useTestApp, login } from "../../test/helpers";

describe("a dragon's own life", () => {
  const env = useTestApp();
  it("has a stable, private daily story without writing on reads or granting stars", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "life@example.com");
    env.ctx.now = () => new Date("2026-11-10T15:59:00Z");
    const before = await env.ctx.db.select().from(characters);
    const a = await owner.get("/api/me/life");
    expect(a.status).toBe(200);
    expect(a.body.today.day).toBe("2026-11-10");
    expect(a.body.today.autonomous).toBeTruthy();
    expect(a.body.activities).toHaveLength(7);
    expect((await owner.get("/api/me/life")).body).toEqual(a.body);
    expect(await env.ctx.db.select().from(characters)).toEqual(before);
    env.ctx.now = () => new Date("2026-11-10T16:01:00Z");
    expect((await owner.get("/api/me/life")).body.today.day).toBe("2026-11-11");
    expect((await owner.get("/api/me")).body.pet.stars).toBe(0);
  });
  const openIds = async (owner: {
    get: (u: string) => Promise<{ body: any }>;
  }): Promise<string[]> =>
    (await owner.get("/api/me/life")).body.activities
      .filter((a: { open: boolean }) => a.open)
      .map((a: { id: string }) => a.id);
  it("writes the story into the day's entry, so later rewording or other seasons never change it", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "seasonal@example.com");
    env.ctx.now = () => new Date("2026-03-10T04:00:00Z");
    const spring = (await owner.get("/api/me/life")).body;
    const first = spring.activities.find((a: { open: boolean }) => a.open);
    expect(first.story).toBeTruthy();
    const played = (await owner.post("/api/me/life/activities").send({ activityId: first.id }))
      .body;
    expect(played.today.entries[0].story).toBe(first.story);
    const [savedDay] = await env.ctx.db.select().from(lifeDays);
    const stored = (savedDay!.entries as Array<{ story?: string; storyId?: string }>)[0]!;
    expect(stored.story).toBe(first.story);
    expect(stored.storyId).toBeTruthy();
    env.ctx.now = () => new Date("2026-06-10T04:00:00Z");
    const summer = (await owner.get("/api/me/life")).body;
    expect(
      summer.history.find((d: { day: string }) => d.day === "2026-03-10").entries[0].story,
    ).toBe(first.story);
  });
  it("opens one or two places a day, turns closed ones away kindly, and takes at least five days to collect all seven", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "play@example.com");
    env.ctx.now = () => new Date("2026-04-01T04:00:00Z");
    const open = await openIds(owner);
    expect(open.length).toBeGreaterThanOrEqual(1);
    expect(open.length).toBeLessThanOrEqual(2);
    const closed = ["shop", "exercise", "music", "visit", "festival", "town", "abroad"].find(
      (id) => !open.includes(id),
    )!;
    const refused = await owner.post("/api/me/life/activities").send({ activityId: closed });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toContain("沒開");
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        owner.post("/api/me/life/activities").send({ activityId: open[0] }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const today = (await owner.get("/api/me/life")).body;
    expect(today.today.entries).toHaveLength(1);
    expect(today.inventory).toHaveLength(1);
    await Promise.all([
      owner.post("/api/me/life/activities").send({ activityId: open[1] ?? open[0] }),
      owner.patch("/api/me/pet").send({ notify: false }),
    ]);
    let days = 1;
    while ((await owner.get("/api/me/life")).body.inventory.length < 7 && days < 12) {
      env.ctx.now = () => new Date(Date.UTC(2026, 3, 1 + days * 2, 4));
      days++;
      for (const activityId of await openIds(owner))
        expect((await owner.post("/api/me/life/activities").send({ activityId })).status).toBe(200);
    }
    expect(days).toBe(5);
    const life = (await owner.get("/api/me/life")).body;
    expect(life.inventory).toHaveLength(7);
    const me = (await owner.get("/api/me")).body;
    expect(me.pet.notify).toBe(false);
    expect(me.pet.stars).toBe(0);
    expect(await env.ctx.db.select().from(deeds)).toEqual([]);
    expect((await owner.put("/api/me/character").send({ ...nova, name: "新名字" })).status).toBe(
      200,
    );
    expect((await owner.get("/api/me/life")).body.inventory).toHaveLength(7);
  });
  it("only equips owned items, keeps a bounded diary and never punishes an absence", async () => {
    env.ctx.now = () => new Date();
    const owner = await userWithCharacter(env.app, "wardrobe@example.com");
    expect((await owner.patch("/api/me/life").send({ outfit: "shop" })).status).toBe(409);
    expect(
      (await owner.post("/api/me/life/activities").send({ activityId: "unknown" })).status,
    ).toBe(400);
    for (let i = 0; i < 65; i++) {
      env.ctx.now = () => new Date(Date.UTC(2026, 0, i + 1, 4));
      const [activityId] = await openIds(owner);
      await owner.post("/api/me/life/activities").send({ activityId });
    }
    const owned = (await owner.get("/api/me/life")).body.inventory.length;
    expect(owned).toBe(7);
    const equipped = await owner.patch("/api/me/life").send({ outfit: "shop" });
    expect(equipped.body.outfit).toBe("shop");
    expect(equipped.body.history.length).toBeLessThanOrEqual(60);
    env.ctx.now = () => new Date("2027-11-10T00:00:00Z");
    await owner.post("/api/auth/dev-login").send({ email: "wardrobe@example.com" });
    const later = (await owner.get("/api/me/life")).body;
    expect(later.inventory).toHaveLength(owned);
    expect(later.outfit).toBe("shop");
    expect(later.mood).toBe("悠閒");
    expect((await owner.patch("/api/me/life").send({ outfit: null })).body.outfit).toBeNull();
    const other = await userWithCharacter(env.app, "isolated@example.com");
    expect((await other.get("/api/me/life")).body.inventory).toEqual([]);
    const noDragon = await login(env.app, "no-dragon@example.com");
    expect((await noDragon.get("/api/me/life")).status).toBe(409);
  });
  it("keeps recognizable diary and keepsakes when a messy record is read and played again", async () => {
    const logs: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logs.push(args);
    });
    try {
      env.ctx.now = () => new Date("2026-03-02T04:00:00Z");
      const owner = await userWithCharacter(env.app, "messy@example.com");
      const [created] = await env.ctx.db.select().from(characters);
      const datedDays = Array.from({ length: 61 }, (_, index) => {
        const day = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
        return {
          day,
          autonomous: `舊日記 ${day}`,
          kept: true,
          entries: [
            { activityId: "shop", at: `${day}T01:00:00.000Z`, note: "scarf" },
            { activityId: "future-game", at: `${day}T02:00:00.000Z` },
            { activityId: "music", at: `${day}T03:00:00.000Z` },
            { activityId: "exercise", at: `${day}T04:00:00.000Z` },
            { activityId: "visit", at: `${day}T05:00:00.000Z` },
            { activityId: "festival", at: `${day}T06:00:00.000Z` },
            { activityId: "town", at: `${day}T07:00:00.000Z` },
            { activityId: "abroad", at: `${day}T08:00:00.000Z` },
            { activityId: "shop", at: `${day}T09:00:00.000Z`, note: "second-scarf" },
          ],
        };
      });
      const undated = {
        autonomous: "沒有日期",
        entries: [{ activityId: "shop", at: "2020-01-01T00:00:00.000Z" }],
      };
      const days = [...datedDays, undated];
      const inventory = [
        ...["shop", "music", "exercise", "visit", "festival", "town", "abroad"].map(
          (activityId, index) => ({
            activityId,
            earnedOn: `2024-04-0${index + 1}`,
            ribbon: activityId,
          }),
        ),
        { activityId: "shop", earnedOn: "2024-04-08", ribbon: "second" },
        { activityId: "forged", earnedOn: "2024-04-09", ribbon: "foreign" },
      ];
      const life = { margin: "手寫", outfit: "handmade-cape", days, inventory };
      await env.ctx.db
        .update(characters)
        .set({ sharing: { allowAiQuotes: true, life } })
        .where(eq(characters.id, created.id));
      const viewed = await owner.get("/api/me/life");
      expect(viewed.status).toBe(200);
      expect(viewed.body.inventory).toHaveLength(8);
      expect(
        viewed.body.history.find((item: { day: string }) => item.day === "2024-03-01").entries,
      ).toHaveLength(8);
      const playedId = (await openIds(owner))[0];
      const played = await owner.post("/api/me/life/activities").send({ activityId: playedId });
      expect(played.status).toBe(200);
      // LW-15: the save now lives in its own tables. Nothing readable is lost, duplicates included,
      // and the original JSON is archived untouched so the parts this version cannot read are still there.
      const [saved] = await env.ctx.db.select().from(characters);
      expect(saved.sharing).toEqual({ allowAiQuotes: true });
      expect(saved.lifeLegacy).toEqual([life]);
      expect(saved.lifeOutfit).toBeNull();
      const dayRows = await env.ctx.db.select().from(lifeDays);
      for (const original of datedDays) {
        const kept = dayRows.filter((row) => row.day === original.day);
        expect(kept).toHaveLength(1);
        const entries = kept[0]!.entries as Array<{ activityId: string }>;
        expect(entries.filter((entry) => entry.activityId === "shop")).toHaveLength(2);
        expect(entries.filter((entry) => entry.activityId === "future-game")).toHaveLength(0);
        for (const activityId of ["music", "exercise", "visit", "festival", "town", "abroad"]) {
          expect(entries.filter((entry) => entry.activityId === activityId)).toHaveLength(1);
        }
      }
      const itemRows = await env.ctx.db.select().from(lifeItems);
      expect(itemRows.filter((item) => item.activityId === "forged")).toHaveLength(0);
      expect(
        itemRows
          .filter((item) => item.activityId === "shop")
          .map((item) => item.earnedOn)
          .sort(),
      ).toEqual(["2024-04-01", "2024-04-08"]);
      expect(itemRows).toHaveLength(8);
      expect(
        dayRows.some(
          (row) =>
            row.day === "2026-03-02" &&
            (row.entries as Array<{ activityId: string }>).some(
              (entry) => entry.activityId === playedId,
            ),
        ),
      ).toBe(true);
      expect(dayRows).toHaveLength(datedDays.length + 1);
      expect(logs.some((args) => String(args[0]).includes("life record:"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
  it("LW-15: the session carries only what home needs, never the diary", async () => {
    env.ctx.now = () => new Date("2026-03-02T04:00:00Z");
    const owner = await userWithCharacter(env.app, "session@example.com");
    const [created] = await env.ctx.db.select().from(characters);
    const life = {
      version: 1,
      outfit: "shop",
      decoration: null,
      allowVisits: true,
      days: [
        {
          day: "2026-03-01",
          autonomous: "只寫在日記裡的悄悄話",
          entries: [
            { activityId: "shop", at: "2026-03-01T03:00:00.000Z", story: "只寫在日記裡的故事" },
          ],
        },
      ],
      inventory: [{ activityId: "shop", earnedOn: "2026-03-01" }],
    };
    await env.ctx.db
      .update(characters)
      .set({ sharing: { allowAiQuotes: false, life } })
      .where(eq(characters.id, created!.id));
    // 還沒搬的舊存檔：session 也只給穿戴與佈置
    const old = await owner.get("/api/session");
    expect(old.body.me.character.life).toEqual({ outfit: "shop", decoration: null });
    expect(old.body.me.character.sharing).toEqual({ allowAiQuotes: false });
    expect(JSON.stringify(old.body)).not.toContain("悄悄話");
    expect(JSON.stringify(old.body)).not.toContain("日記裡的故事");
    // 打開生活頁時搬家，一筆不少
    const view = (await owner.get("/api/me/life")).body;
    expect(view.history.find((d: { day: string }) => d.day === "2026-03-01").entries[0].story).toBe(
      "只寫在日記裡的故事",
    );
    expect(view).toMatchObject({ outfit: "shop", decoration: null, allowVisits: true });
    expect(view.inventory).toEqual([{ activityId: "shop", earnedOn: "2026-03-01" }]);
    const [moved] = await env.ctx.db.select().from(characters);
    expect(moved).toMatchObject({
      sharing: { allowAiQuotes: false },
      allowVisits: true,
      lifeOutfit: "shop",
      lifeDecoration: null,
      lifeLegacy: [life],
    });
    const session = await owner.get("/api/session");
    expect(session.body.me.character).toEqual({
      id: created!.id,
      name: "Nova",
      appearance: created!.appearance,
      personality: created!.personality,
      sharing: { allowAiQuotes: false },
      life: { outfit: "shop", decoration: null },
    });
    expect(JSON.stringify(session.body)).not.toContain("悄悄話");
    // 換下圍巾後 session 跟著變，日記還在
    expect((await owner.patch("/api/me/life").send({ outfit: null })).body.outfit).toBeNull();
    expect((await owner.get("/api/session")).body.me.character.life).toEqual({
      outfit: null,
      decoration: null,
    });
    expect(await env.ctx.db.select().from(lifeDays)).toHaveLength(1);
    // 改角色設定不會把生活資料帶回 sharing
    await owner.put("/api/me/character").send({ ...nova, sharing: { allowAiQuotes: true } });
    const [after] = await env.ctx.db.select().from(characters);
    expect(after!.sharing).toEqual({ allowAiQuotes: true });
    expect(after!.allowVisits).toBe(true);
  });
  it("refuses to overwrite a life record it cannot migrate", async () => {
    const logs: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logs.push(args);
    });
    try {
      env.ctx.now = () => new Date("2026-03-02T04:00:00Z");
      const owner = await userWithCharacter(env.app, "wrinkled@example.com");
      const [created] = await env.ctx.db.select().from(characters);
      await env.ctx.db
        .update(characters)
        .set({ sharing: { allowAiQuotes: true, life: "wrinkled page" } })
        .where(eq(characters.id, created.id));
      const refused = await owner.post("/api/me/life/activities").send({ activityId: "shop" });
      expect(refused.status).toBe(409);
      expect(refused.body.error.message).toContain("皺");
      const [saved] = await env.ctx.db.select().from(characters);
      expect((saved.sharing as { life: unknown }).life).toBe("wrinkled page");
      const future = {
        version: 2,
        extra: "keep",
        days: [
          {
            day: "2024-05-01",
            autonomous: "未來的格式",
            entries: [{ activityId: "shop", at: "2024-05-01T01:00:00.000Z" }],
          },
        ],
        inventory: [{ activityId: "shop", earnedOn: "2024-05-01" }],
      };
      await env.ctx.db
        .update(characters)
        .set({ sharing: { allowAiQuotes: true, life: future } })
        .where(eq(characters.id, created.id));
      const blocked = await owner.post("/api/me/life/activities").send({ activityId: "music" });
      expect(blocked.status).toBe(409);
      const [again] = await env.ctx.db.select().from(characters);
      expect((again.sharing as { life: unknown }).life).toEqual(future);
      expect(again.lifeLegacy).toBeNull();
      expect(await env.ctx.db.select().from(lifeDays)).toHaveLength(0);
      expect(await env.ctx.db.select().from(lifeItems)).toHaveLength(0);
      expect(
        logs.some((args) => String(args[0]).includes("life record: refusing to overwrite")),
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  async function sharedDeed(email: string, name: string, title: string) {
    const agent = await userWithCharacter(env.app, email, { ...nova, name });
    const w = (await agent.post("/api/me/wants").send({ text: "想唱歌", districtKey: "music" }))
      .body;
    const s = (
      await agent.post("/api/first-steps").send({ executor: "self", text: title, wantId: w.id })
    ).body;
    const deed = (
      await agent
        .post(`/api/first-steps/${s.id}/complete`)
        .send({ noteAfter: "只有我知道的私事 A123", noteShared: false })
    ).body.deed;
    return { agent, deed };
  }

  it("G9: visits are off by default, need an explicit opt-in, and never leak private details", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00Z");
    const me = await userWithCharacter(env.app, "me@example.com", { ...nova, name: "我家小龍" });
    const friend = await userWithCharacter(env.app, "friend@example.com", {
      ...nova,
      name: "阿綠",
    });
    const first = (await me.get("/api/me/life")).body;
    expect(first.allowVisits).toBe(false);
    expect(first.encounter).toEqual({ kind: "town", name: "小栗" });
    // 朋友預設不串門，所以不會被選到
    expect((await friend.get("/api/me/life")).body.allowVisits).toBe(false);
    expect((await me.get("/api/me/life")).body.encounter.kind).toBe("town");
    // 朋友同意後才會遇到
    expect((await friend.patch("/api/me/life").send({ allowVisits: true })).body.allowVisits).toBe(
      true,
    );
    // 沒有要去串門時，生活頁不查同意串門的名單
    expect((await me.get("/api/me/life")).body.encounter).toEqual({ kind: "town", name: "小栗" });
    const met = (await me.get("/api/me/life?visit=1")).body;
    expect(met.encounter).toMatchObject({
      kind: "player",
      name: "阿綠",
      appearance: { body: "round" },
    });
    expect(JSON.stringify(met)).not.toContain("friend@example.com");
    expect(Object.keys(met.encounter).sort()).toEqual(["appearance", "kind", "name"]);
    expect((await me.get("/api/me/life?visit=1")).body.encounter).toEqual(met.encounter); // 同一天穩定
    // 不會遇到自己
    expect((await friend.get("/api/me/life?visit=1")).body.encounter.kind).toBe("town");
    // 結果日記沒有複製對方資料
    const todayId = (await openIds(me))[0];
    const played = (await me.post("/api/me/life/activities").send({ activityId: todayId })).body;
    expect((await me.get("/api/me/life?visit=1")).body.encounter.name).toBe("阿綠");
    expect(played.today).toBeTruthy();
    const stored = (
      await env.ctx.db.select().from(characters).where(eq(characters.name, "我家小龍"))
    )[0]!;
    expect(JSON.stringify(stored)).not.toContain("阿綠");
    const diary = await env.ctx.db
      .select()
      .from(lifeDays)
      .where(eq(lifeDays.characterId, stored.id));
    expect(diary).toHaveLength(1);
    expect(JSON.stringify(diary)).not.toContain("阿綠");
    // 撤回後未來不再出現
    expect((await friend.patch("/api/me/life").send({ allowVisits: false })).body.allowVisits).toBe(
      false,
    );
    expect((await me.get("/api/me/life?visit=1")).body.encounter).toEqual({
      kind: "town",
      name: "小栗",
    });
    expect((await friend.patch("/api/me/life").send({ allowVisits: "yes" })).status).toBe(400);
  });

  it("G10: the town-heart entry only shows public, unremoved deeds from other people and vanishes when pulled", async () => {
    env.ctx.now = () => new Date("2026-11-10T04:00:00Z");
    const me = await userWithCharacter(env.app, "me2@example.com");
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    const own = await sharedDeed("own@example.com", "小米", "去上一次聲樂試用課");
    const seen = (await me.get("/api/me/life")).body.inspiration;
    expect(seen).toMatchObject({
      title: "去上一次聲樂試用課",
      who: "小米",
      placeId: own.deed.placeId,
      isDemo: false,
    });
    expect(JSON.stringify(seen)).not.toContain("A123");
    expect(JSON.stringify(seen)).not.toContain("own@example.com");
    expect((await own.agent.get("/api/me/life")).body.inspiration).toBeNull(); // 看不到自己的
    // 設成私密後立刻消失
    expect(
      (await own.agent.patch(`/api/deeds/${own.deed.id}`).send({ visibility: "private" })).status,
    ).toBe(200);
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    await own.agent.patch(`/api/deeds/${own.deed.id}`).send({ visibility: "public" });
    expect((await me.get("/api/me/life")).body.inspiration?.title).toBe("去上一次聲樂試用課");
    // 管理者下架後消失
    const admin = await login(env.app, "admin@example.com");
    expect((await admin.post(`/api/admin/deeds/${own.deed.id}/remove`)).status).toBe(200);
    expect((await me.get("/api/me/life")).body.inspiration).toBeNull();
    // 讀取不寫入，也沒有生成任何真人事蹟或星星
    expect((await me.get("/api/me")).body.pet.stars).toBe(0);
  });
});
