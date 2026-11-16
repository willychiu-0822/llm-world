import { autonomousLife, commitLife, LIFE_ACTIVITIES, lifeActivityInput, lifeApplyPlay, lifeClock, lifeEntryStory, lifePatchInput, lifePick, lifePlan, lifeScene, migrateLife, type LifeRecord, type LifeState, type LifeView } from "@lj/core";
import { characters, deeds, places, providers } from "@lj/db";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";
import { visibleDeed } from "./deeds";
import { visiblePlace } from "./town";

function logLife(characterId: string, record: LifeRecord) {
  if (record.issues.length === 0) return;
  console.error(record.canWrite ? "life record: unreadable parts were left in place" : "life record: refusing to overwrite", { characterId, issues: record.issues });
}
function readState(c: { id: string; sharing: unknown }) {
  const record = migrateLife(c.sharing);
  logLife(c.id, record);
  return record.state;
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

/** 同意串門的其他玩家小龍（不含示範角色）；只回名字與外觀，每天固定同一位。 */
async function findEncounter(ctx: AppContext, self: { id: string }, day: string): Promise<LifeView["encounter"]> {
  const rows = await ctx.db
    .select({ name: characters.name, appearance: characters.appearance })
    .from(characters)
    .where(and(ne(characters.id, self.id), eq(characters.isDemo, false), sql`${characters.sharing} -> 'life' ->> 'allowVisits' = 'true'`))
    .orderBy(asc(characters.id));
  const pick = rows[lifePick(`${self.id}:${day}:visit`, rows.length)];
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

type CharacterRow = typeof characters.$inferSelect;
async function present(ctx: AppContext, c: Pick<CharacterRow, "id" | "userId" | "sharing">): Promise<LifeView> {
  const now = ctx.now();
  const base = presentBase(readState(c), c.id, now);
  return { ...base, encounter: await findEncounter(ctx, c, base.day), inspiration: await findInspiration(ctx, c, base.day) };
}

async function own(ctx: AppContext, userId: string) {
  const [c] = await ctx.db.select().from(characters).where(eq(characters.userId, userId)).limit(1);
  if (!c) throw new AppError("conflict", "先把小龍帶回家");
  return c;
}
export async function getLife(ctx: AppContext, userId: string) {
  const c = await own(ctx, userId);
  return present(ctx, c);
}
async function mutate(ctx: AppContext, userId: string, change: (life: LifeState, id: string, now: Date) => void) {
  const c = await ctx.db.transaction(async tx => {
    const [c] = await tx.select().from(characters).where(eq(characters.userId, userId)).for("update");
    if (!c) throw new AppError("conflict", "先把小龍帶回家");
    const record = migrateLife(c.sharing);
    logLife(c.id, record);
    if (!record.canWrite) throw new AppError("conflict", "小龍的日記這頁皺了，先留著沒改。");
    const before = structuredClone(record.state);
    change(record.state, c.id, ctx.now());
    const life = commitLife(record, before, record.state);
    await tx.update(characters).set({ sharing: sql`jsonb_set(${characters.sharing}, '{life}', ${JSON.stringify(life)}::jsonb)` }).where(eq(characters.id, c.id));
    return c;
  });
  return getLife(ctx, c.userId);
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
  const c = await own(ctx, userId);
  const v = presentBase(readState(c), c.id, ctx.now());
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
