import { bookings, places, providers, trialFaqs, trialSessions, trials } from "@lj/db";
import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";

export type TrialRow = typeof trials.$inferSelect;

export function trialDto(t: TrialRow) {
  return {
    id: t.id,
    placeId: t.placeId,
    title: t.title,
    description: t.description,
    durationMin: t.durationMin,
    exitAnytime: t.exitAnytime,
    buddyOk: t.buddyOk,
    whenText: t.whenText,
    processInfo: t.processInfo,
    aiFirstStepHint: t.aiFirstStepHint,
    selfFirstStepHint: t.selfFirstStepHint,
    status: t.status,
    isDemo: t.isDemo,
    createdAt: t.createdAt,
  };
}

export async function upcomingSessions(ctx: AppContext, trialIds: string[]) {
  if (!trialIds.length) return [];
  const since = new Date(ctx.now().getTime() - 12 * 3600_000);
  const ss = await ctx.db
    .select()
    .from(trialSessions)
    .where(and(inArray(trialSessions.trialId, trialIds), gte(trialSessions.startsAt, since)))
    .orderBy(asc(trialSessions.startsAt));
  const taken = ss.length
    ? await ctx.db.select({ sessionId: bookings.sessionId, c: count() }).from(bookings).where(inArray(bookings.sessionId, ss.map((s) => s.id))).groupBy(bookings.sessionId)
    : [];
  return ss.map((s) => ({
    trialId: s.trialId,
    id: s.id,
    startsAt: s.startsAt,
    capacity: s.capacity,
    remaining: Math.max(0, s.capacity - (taken.find((t) => t.sessionId === s.id)?.c ?? 0)),
  }));
}

export async function listTrialsForPlace(ctx: AppContext, placeId: string) {
  const ts = await ctx.db
    .select({ trial: trials })
    .from(trials)
    .innerJoin(providers, eq(providers.id, trials.providerId))
    .where(and(eq(trials.placeId, placeId), eq(trials.status, "active"), eq(providers.status, "approved")));
  return ts.map(({ trial }) => trialDto(trial));
}

/** Public view of a trial; only for approved providers and active trials. */
export async function getTrialView(ctx: AppContext, trialId: string) {
  const [row] = await ctx.db
    .select({ trial: trials, provider: providers, place: places })
    .from(trials)
    .innerJoin(providers, eq(providers.id, trials.providerId))
    .innerJoin(places, eq(places.id, trials.placeId))
    .where(and(eq(trials.id, trialId), eq(trials.status, "active"), eq(providers.status, "approved")))
    .limit(1);
  if (!row) throw notFound("trial");
  const faqs = await ctx.db.select({ id: trialFaqs.id, question: trialFaqs.question, answer: trialFaqs.answer }).from(trialFaqs).where(eq(trialFaqs.trialId, trialId)).orderBy(asc(trialFaqs.createdAt));
  const sessions = (await upcomingSessions(ctx, [trialId])).map(({ trialId: _t, ...s }) => s);
  return {
    ...trialDto(row.trial),
    provider: { id: row.provider.id, name: row.provider.name, description: row.provider.description },
    place: { id: row.place.id, name: row.place.name, districtKey: row.place.districtKey, realAddress: row.place.realAddress, online: row.place.online },
    faqs,
    sessions,
  };
}
