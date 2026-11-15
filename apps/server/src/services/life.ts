import { autonomousLife, commitLife, LIFE_ACTIVITIES, lifeActivityInput, lifeApplyPlay, lifeClock, lifeEntryStory, lifePatchInput, lifePick, lifePlan, lifeScene, migrateLife, type LifeRecord, type LifeState } from "@lj/core";
import { characters } from "@lj/db";
import { eq, sql } from "drizzle-orm";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";

function logLife(characterId: string, record: LifeRecord) {
  if (record.issues.length === 0) return;
  console.error(record.canWrite ? "life record: unreadable parts were left in place" : "life record: refusing to overwrite", { characterId, issues: record.issues });
}
function present(life: LifeState, id: string, now: Date) {
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
export type LifeView = ReturnType<typeof present>;

async function own(ctx: AppContext, userId: string) {
  const [c] = await ctx.db.select().from(characters).where(eq(characters.userId, userId)).limit(1);
  if (!c) throw new AppError("conflict", "先把小龍帶回家");
  return c;
}
export async function getLife(ctx: AppContext, userId: string) {
  const c = await own(ctx, userId);
  const record = migrateLife(c.sharing);
  logLife(c.id, record);
  return present(record.state, c.id, ctx.now());
}
async function mutate(ctx: AppContext, userId: string, change: (life: LifeState, id: string, now: Date) => void) {
  await ctx.db.transaction(async tx => {
    const [c] = await tx.select().from(characters).where(eq(characters.userId, userId)).for("update");
    if (!c) throw new AppError("conflict", "先把小龍帶回家");
    const record = migrateLife(c.sharing);
    logLife(c.id, record);
    if (!record.canWrite) throw new AppError("conflict", "小龍的日記這頁皺了，先留著沒改。");
    const before = structuredClone(record.state);
    change(record.state, c.id, ctx.now());
    const life = commitLife(record, before, record.state);
    await tx.update(characters).set({ sharing: sql`jsonb_set(${characters.sharing}, '{life}', ${JSON.stringify(life)}::jsonb)` }).where(eq(characters.id, c.id));
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
