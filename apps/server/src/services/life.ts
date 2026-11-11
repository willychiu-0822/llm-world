import { autonomousLife, LIFE_ACTIVITIES, lifeActivityInput, lifeActivityStory, lifeClock, lifePatchInput, lifePick, lifeScene, readLife, type LifeState } from "@lj/core";
import { characters } from "@lj/db";
import { eq, sql } from "drizzle-orm";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";

function present(sharing: unknown, id: string, now: Date) {
  const life = readLife(sharing);
  const clock = lifeClock(now);
  const today = life.days.find(d => d.day === clock.day) ?? { day: clock.day, autonomous: autonomousLife(id, clock.day), entries: [] };
  const recommended = LIFE_ACTIVITIES[lifePick(`${id}:${clock.day}:wish`, LIFE_ACTIVITIES.length)]!;
  const withStories = (d: typeof today) => ({ ...d, entries: d.entries.map(e => ({ ...e, story: lifeActivityStory(e.activityId, new Date(e.at)) })) });
  const history = [today, ...life.days.filter(d => d.day !== clock.day)].sort((a,b) => b.day.localeCompare(a.day)).slice(0, 60).map(withStories);
  return {
    ...clock, today: withStories(today), history, inventory: life.inventory, outfit: life.outfit, decoration: life.decoration,
    allowVisits: life.allowVisits, mood: today.entries.length ? "滿足" : "悠閒", wish: recommended.wish, help: recommended.help,
    scene: lifeScene(now), recommendedId: recommended.id,
    activities: LIFE_ACTIVITIES.map(a => ({ ...a, story: lifeActivityStory(a.id, now), done: today.entries.some(e => e.activityId === a.id) })),
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
  return present(c.sharing, c.id, ctx.now());
}
async function mutate(ctx: AppContext, userId: string, change: (life: LifeState, id: string, now: Date) => void) {
  await ctx.db.transaction(async tx => {
    const [c] = await tx.select().from(characters).where(eq(characters.userId, userId)).for("update");
    if (!c) throw new AppError("conflict", "先把小龍帶回家");
    const life = readLife(c.sharing);
    change(life, c.id, ctx.now());
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
      life.days = [...life.days, today].sort((a,b) => b.day.localeCompare(a.day)).slice(0,60);
    }
    if (today.entries.some(e => e.activityId === activityId)) return;
    today.entries.push({activityId, at: now.toISOString()});
    if (!life.inventory.some(i => i.activityId === activityId)) life.inventory.push({ activityId, earnedOn: day });
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
