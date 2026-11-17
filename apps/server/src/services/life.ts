import { autonomousLife, LIFE_ACTIVITIES, lifeActivityInput, lifeApplyPlay, lifeClock, lifeEntryStory, lifePatchInput, lifePick, lifePlan, lifeScene, migrateLife, type LifeActivityId, type LifeRecord, type LifeState, type LifeView } from "@lj/core";
import { characters, deeds, hasLegacyLife, lifeDays, lifeItems, moveLifeRecord, places, providers, type DbOrTx } from "@lj/db";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";
import { visibleDeed } from "./deeds";
import { visiblePlace } from "./town";

function logLife(characterId: string, record: LifeRecord) {
  if (record.issues.length === 0) return;
  console.error(record.canWrite ? "life record: unreadable parts were kept in the archive" : "life record: refusing to overwrite", { characterId, issues: record.issues });
}

type CharacterRow = typeof characters.$inferSelect;
type Loaded = { state: LifeState; dayIds: Map<object, number>; itemIds: Set<object>; blocked: boolean };

/** 首頁只需要的兩個值：穿戴與佈置。還沒搬的舊存檔照舊讀法看。 */
export function lifeLook(c: Pick<CharacterRow, "sharing" | "lifeOutfit" | "lifeDecoration">) {
  if (hasLegacyLife(c.sharing)) {
    const { outfit, decoration } = migrateLife(c.sharing).state;
    return { outfit, decoration };
  }
  return { outfit: c.lifeOutfit === "shop" ? "shop" as const : null, decoration: c.lifeDecoration === "festival" ? "festival" as const : null };
}

/** Reads the life tables. A save that could not be moved is shown as before and marked `blocked`. */
async function load(db: DbOrTx, c: CharacterRow): Promise<Loaded> {
  if (hasLegacyLife(c.sharing)) {
    const record = migrateLife(c.sharing);
    logLife(c.id, record);
    return { state: record.state, dayIds: new Map(), itemIds: new Set(), blocked: true };
  }
  const dayRows = await db.select().from(lifeDays).where(eq(lifeDays.characterId, c.id)).orderBy(desc(lifeDays.day), asc(lifeDays.id));
  const itemRows = await db.select().from(lifeItems).where(eq(lifeItems.characterId, c.id)).orderBy(asc(lifeItems.id));
  const dayIds = new Map<object, number>();
  const itemIds = new Set<object>();
  const days = dayRows.map(r => {
    const day = { day: r.day, autonomous: r.autonomous, entries: r.entries as LifeState["days"][number]["entries"] };
    dayIds.set(day, r.id);
    return day;
  });
  const inventory = itemRows.map(r => {
    const item = { activityId: r.activityId as LifeActivityId, earnedOn: r.earnedOn };
    itemIds.add(item);
    return item;
  });
  return { state: { version: 1, days, inventory, ...lifeLook(c), allowVisits: c.allowVisits }, dayIds, itemIds, blocked: false };
}
/** Moves an old save the first time it is touched. Returns the fresh row, or null when it has to stay put. */
async function moveIfLegacy(tx: DbOrTx, c: CharacterRow): Promise<CharacterRow | null> {
  if (!hasLegacyLife(c.sharing)) return c;
  const { moved, record } = await moveLifeRecord(tx, c);
  logLife(c.id, record);
  if (!moved) return null;
  const [fresh] = await tx.select().from(characters).where(eq(characters.id, c.id));
  return fresh!;
}
function presentBase(life: LifeState, id: string, now: Date) {
  const clock = lifeClock(now);
  const today = life.days.find(d => d.day === clock.day) ?? { day: clock.day, autonomous: autonomousLife(id, clock.day), entries: [] };
  const plan = lifePlan(id, now, life);
  const openList = LIFE_ACTIVITIES.filter(a => plan.open.includes(a.id));
  const recommended = openList[lifePick(`${id}:${clock.day}:wish`, openList.length)]!;
  const withStories = (d: typeof today) => ({ ...d, entries: d.entries.map(e => ({ ...e, story: lifeEntryStory(e) })) });
  const history = [today, ...life.days.filter(d => d.day !== clock.day)].sort((a,b) => b.day.localeCompare(a.day)).slice(0, 60).map(withStories);
  return {
    ...clock, today: withStories(today), history, inventory: life.inventory, outfit: life.outfit, decoration: life.decoration,
    allowVisits: life.allowVisits, mood: today.entries.length ? "滿足" : "悠閒", wish: recommended.wish, help: recommended.help,
    scene: lifeScene(now), recommendedId: recommended.id,
    activities: LIFE_ACTIVITIES.map(a => {
      const entry = today.entries.find(e => e.activityId === a.id);
      return { ...a, story: entry ? lifeEntryStory(entry) : plan.stories[a.id]?.text ?? "", done: !!entry, open: plan.open.includes(a.id) };
    }),
  };
}

const TOWN_HOST = { kind: "town" as const, name: "小栗" };

/** 同意串門的其他玩家小龍（不含示範角色）；只回名字與外觀，每天固定同一位。走 allow_visits 索引，只取第 N 筆。 */
async function findEncounter(ctx: AppContext, self: { id: string }, day: string): Promise<LifeView["encounter"]> {
  const where = and(ne(characters.id, self.id), eq(characters.isDemo, false), eq(characters.allowVisits, true));
  const [{ n }] = await ctx.db.select({ n: count() }).from(characters).where(where);
  const total = Number(n);
  if (!total) return TOWN_HOST;
  const [pick] = await ctx.db
    .select({ name: characters.name, appearance: characters.appearance })
    .from(characters)
    .where(where)
    .orderBy(asc(characters.id))
    .limit(1)
    .offset(lifePick(`${self.id}:${day}:visit`, total));
  return pick ? { kind: "player", name: pick.name, appearance: pick.appearance } : TOWN_HOST;
}

/** 別人公開、未下架的一則經驗。每次讀取都重查，不快取別人的文字。真人優先，沒有才用示範內容。 */
async function findInspiration(ctx: AppContext, self: { id: string; userId: string }, day: string): Promise<LifeView["inspiration"]> {
  const rows = await ctx.db
    .select({ title: deeds.title, placeId: deeds.placeId, placeName: places.name, isDemo: deeds.isDemo, who: characters.name })
    .from(deeds)
    .innerJoin(places, eq(places.id, deeds.placeId))
    .leftJoin(providers, eq(providers.id, places.providerId))
    .leftJoin(characters, eq(characters.userId, deeds.userId))
    .where(and(visibleDeed(), visiblePlace(), ne(deeds.userId, self.userId)))
    .orderBy(asc(deeds.isDemo), desc(deeds.createdAt), asc(deeds.id))
    .limit(30);
  const real = rows.filter(r => !r.isDemo);
  const pool = real.length ? real : rows;
  const pick = pool[lifePick(`${self.id}:${day}:heart`, pool.length)];
  return pick ? { placeId: pick.placeId, placeName: pick.placeName, title: pick.title, who: pick.who ?? "鎮民", isDemo: pick.isDemo } : null;
}

async function present(ctx: AppContext, c: Pick<CharacterRow, "id" | "userId">, life: LifeState, visit = false): Promise<LifeView> {
  const base = presentBase(life, c.id, ctx.now());
  const visiting = visit || base.today.entries.some(e => e.activityId === "visit");
  return {
    ...base,
    encounter: visiting ? await findEncounter(ctx, c, base.day) : TOWN_HOST,
    inspiration: await findInspiration(ctx, c, base.day),
  };
}

/** The owner's character with its life loaded. An old save is moved to the tables on the way. */
async function own(ctx: AppContext, userId: string) {
  let [c] = await ctx.db.select().from(characters).where(eq(characters.userId, userId)).limit(1);
  if (!c) throw new AppError("conflict", "先把小龍帶回家");
  if (hasLegacyLife(c.sharing)) {
    c = await ctx.db.transaction(async tx => {
      const [locked] = await tx.select().from(characters).where(eq(characters.userId, userId)).for("update");
      return (await moveIfLegacy(tx, locked!)) ?? locked!;
    });
  }
  return { c, life: (await load(ctx.db, c)).state };
}
export async function getLife(ctx: AppContext, userId: string, opts: { visit?: boolean } = {}) {
  const { c, life } = await own(ctx, userId);
  return present(ctx, c, life, opts.visit);
}
async function mutate(ctx: AppContext, userId: string, change: (life: LifeState, id: string, now: Date) => void) {
  await ctx.db.transaction(async tx => {
    const [locked] = await tx.select().from(characters).where(eq(characters.userId, userId)).for("update");
    if (!locked) throw new AppError("conflict", "先把小龍帶回家");
    const c = await moveIfLegacy(tx, locked);
    if (!c) throw new AppError("conflict", "小龍的日記這頁皺了，先留著沒改。");
    const { state, dayIds, itemIds } = await load(tx, c);
    const stored = new Map([...dayIds].map(([day, id]) => [id, JSON.stringify(day)]));
    const before = { allowVisits: state.allowVisits, outfit: state.outfit, decoration: state.decoration };
    change(state, c.id, ctx.now());
    // Only what changed is written: one day row, one keepsake row, or the three columns.
    const kept = new Set<number>();
    for (const day of state.days) {
      const id = dayIds.get(day);
      const values = { day: day.day, autonomous: day.autonomous, entries: day.entries };
      if (id === undefined) await tx.insert(lifeDays).values({ characterId: c.id, ...values });
      else {
        kept.add(id);
        if (JSON.stringify(day) !== stored.get(id)) await tx.update(lifeDays).set(values).where(eq(lifeDays.id, id));
      }
    }
    const dropped = [...stored.keys()].filter(id => !kept.has(id));
    if (dropped.length) await tx.delete(lifeDays).where(inArray(lifeDays.id, dropped));
    const fresh = state.inventory.filter(i => !itemIds.has(i));
    if (fresh.length) await tx.insert(lifeItems).values(fresh.map(i => ({ characterId: c.id, activityId: i.activityId, earnedOn: i.earnedOn })));
    if (state.allowVisits !== before.allowVisits || state.outfit !== before.outfit || state.decoration !== before.decoration) {
      await tx.update(characters).set({ allowVisits: state.allowVisits, lifeOutfit: state.outfit, lifeDecoration: state.decoration }).where(eq(characters.id, c.id));
    }
  });
  return getLife(ctx, userId);
}
export async function playLife(ctx: AppContext, userId: string, raw: unknown) {
  const { activityId } = lifeActivityInput.parse(raw);
  return mutate(ctx, userId, (life, id, now) => {
    const { day } = lifeClock(now);
    let today = life.days.find(d => d.day === day);
    if (!today) {
      today = { day, autonomous: autonomousLife(id, day), entries: [] };
      const alreadyStored = life.days.length;
      const next = [...life.days, today].sort((a,b) => b.day.localeCompare(a.day));
      // A normal diary stays within 60 days. An older save that is already longer is not trimmed.
      life.days = alreadyStored > 60 ? next : next.slice(0, 60);
    }
    if (lifeApplyPlay(id, now, life, activityId) === "closed") throw new AppError("conflict", "今天這裡沒開，換個地方陪小龍去吧。");
  });
}
export async function patchLife(ctx: AppContext, userId: string, raw: unknown) {
  const patch = lifePatchInput.parse(raw);
  return mutate(ctx, userId, life => {
    for (const key of ["outfit", "decoration"] as const) {
      const value = patch[key];
      if (value && !life.inventory.some(i => i.activityId === value)) throw new AppError("conflict", "這件還沒帶回家喔。");
    }
    Object.assign(life, patch);
  });
}

/** 給會說話的朋友讀：只有本人小龍的虛構小日子。不含串門對象、公開來源、設定或任何真人資料；不寫入。 */
export async function getLifeForFriend(ctx: AppContext, userId: string) {
  const { c, life } = await own(ctx, userId);
  const v = presentBase(life, c.id, ctx.now());
  const byId = (id: string) => LIFE_ACTIVITIES.find(a => a.id === id)!;
  return {
    note: "這些是小龍虛構的小日子，不是任何真人做過的事。聊天時可以當小故事講，不要說成真人的經驗，也不要拿來算星星。",
    today: {
      day: v.day, season: v.season, period: v.period, mood: v.mood, scene: v.scene, autonomous: v.today.autonomous, wish: v.wish, help: v.help,
      doneToday: v.today.entries.map(e => ({ name: byId(e.activityId).name, reward: byId(e.activityId).reward, story: e.story })),
      canStillDo: v.activities.filter(a => !a.done && a.open).map(a => a.name),
    },
    recentDays: v.history.filter(d => d.day !== v.day).slice(0, 7).map(d => ({ day: d.day, autonomous: d.autonomous, did: d.entries.map(e => byId(e.activityId).name) })),
    collection: { owned: v.inventory.map(i => byId(i.activityId).reward), total: LIFE_ACTIVITIES.length },
  };
}
