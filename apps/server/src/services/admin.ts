import { characters, deeds, firstSteps, moderationLog, notes, places, providers, trials, users } from "@lj/db";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";
import { notify } from "./notifications";

export async function listProviders(ctx: AppContext, status?: string) {
  const s = status ? z.enum(["pending", "approved", "suspended"]).parse(status) : undefined;
  return ctx.db
    .select({ id: providers.id, name: providers.name, description: providers.description, status: providers.status, email: users.email, isDemo: providers.isDemo, createdAt: providers.createdAt })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(s ? eq(providers.status, s) : undefined)
    .orderBy(desc(providers.createdAt));
}

export async function setProviderStatus(ctx: AppContext, providerId: string, status: "approved" | "suspended") {
  const [p] = await ctx.db.update(providers).set({ status }).where(eq(providers.id, providerId)).returning();
  if (!p) throw notFound("provider");
  const [u] = await ctx.db.select().from(users).where(eq(users.id, p.userId));
  const roles = new Set(u.roles);
  if (status === "approved") roles.add("provider");
  else roles.delete("provider");
  await ctx.db.update(users).set({ roles: [...roles] }).where(eq(users.id, u.id));
  if (status === "approved") await notify(ctx, u.id, "provider_approved", { providerId: p.id, name: p.name });
  return { id: p.id, status: p.status };
}

export async function listModeration(ctx: AppContext) {
  return ctx.db.select().from(moderationLog).orderBy(desc(moderationLog.createdAt)).limit(200);
}

export async function removeDeed(ctx: AppContext, deedId: string) {
  const [d] = await ctx.db.update(deeds).set({ moderationState: "removed" }).where(eq(deeds.id, deedId)).returning();
  if (!d) throw notFound("deed");
  return { id: d.id, moderationState: d.moderationState };
}

/** Counts for the core loop's health indicators. */
export async function getMetrics(ctx: AppContext) {
  const one = async (q: Promise<{ c: number }[]>) => (await q)[0]?.c ?? 0;
  const stepRows = await ctx.db.select({ status: firstSteps.status, executor: firstSteps.executor, c: count() }).from(firstSteps).groupBy(firstSteps.status, firstSteps.executor);
  const sum = (f: (r: (typeof stepRows)[number]) => boolean) => stepRows.filter(f).reduce((n, r) => n + r.c, 0);
  const deedRows = await ctx.db.select({ isDemo: deeds.isDemo, c: count() }).from(deeds).groupBy(deeds.isDemo);
  const noteRows = await ctx.db.select({ kind: notes.kind, shared: notes.shared, c: count() }).from(notes).groupBy(notes.kind, notes.shared);
  const followed = await one(ctx.db.select({ c: sql<number>`count(distinct ${deeds.id})::int` }).from(deeds).where(sql`exists (select 1 from follows f where f.deed_id = ${deeds.id})`));
  return {
    users: await one(ctx.db.select({ c: count() }).from(users).where(eq(users.isDemo, false))),
    characters: await one(ctx.db.select({ c: count() }).from(characters).where(eq(characters.isDemo, false))),
    steps: {
      total: sum(() => true),
      draft: sum((r) => r.status === "draft"),
      confirmed: sum((r) => r.status === "confirmed"),
      done: sum((r) => r.status === "done"),
      dropped: sum((r) => r.status === "dropped"),
      byExecutor: { ai: sum((r) => r.executor === "ai"), self: sum((r) => r.executor === "self") },
    },
    deeds: {
      total: deedRows.reduce((n, r) => n + r.c, 0),
      real: deedRows.find((r) => !r.isDemo)?.c ?? 0,
      demo: deedRows.find((r) => r.isDemo)?.c ?? 0,
      followed,
    },
    notes: {
      before: noteRows.filter((r) => r.kind === "before").reduce((n, r) => n + r.c, 0),
      after: noteRows.filter((r) => r.kind === "after").reduce((n, r) => n + r.c, 0),
      shared: noteRows.filter((r) => r.shared).reduce((n, r) => n + r.c, 0),
    },
  };
}

/** Removes every demo row. Real deeds that pointed at demo shops move to the district's public place. */
export async function purgeDemo(ctx: AppContext) {
  const demoPlaces = await ctx.db.select({ id: places.id, districtKey: places.districtKey }).from(places).where(eq(places.isDemo, true));
  for (const p of demoPlaces) {
    await ctx.db.update(deeds).set({ placeId: `pub_${p.districtKey}`, trialId: null }).where(and(eq(deeds.placeId, p.id), eq(deeds.isDemo, false)));
  }
  const demoTrials = await ctx.db.select({ id: trials.id }).from(trials).where(eq(trials.isDemo, true));
  if (demoTrials.length) await ctx.db.update(deeds).set({ trialId: null }).where(and(inArray(deeds.trialId, demoTrials.map((t) => t.id)), eq(deeds.isDemo, false)));
  const removedDeeds = await ctx.db.delete(deeds).where(eq(deeds.isDemo, true)).returning({ id: deeds.id });
  const removedUsers = await ctx.db.delete(users).where(eq(users.isDemo, true)).returning({ id: users.id });
  await ctx.db.delete(places).where(eq(places.isDemo, true));
  return { deeds: removedDeeds.length, users: removedUsers.length };
}
