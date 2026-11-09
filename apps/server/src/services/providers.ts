import { answerInput, faqInput, providerApplyInput, sessionInput, shopInput, trialInput } from "@lj/core";
import {
  bookings,
  characters,
  deeds,
  firstSteps,
  follows,
  newId,
  notes,
  places,
  providerQuestions,
  providers,
  trialEvents,
  trialFaqs,
  trialSessions,
  trials,
} from "@lj/db";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../context";
import { AppError, forbidden, notFound } from "../http/errors";
import { createDeedFromStep } from "./deeds";
import { moderate } from "./moderation";
import { notify } from "./notifications";
import { trialDto, upcomingSessions } from "./trials";

export type ProviderRow = typeof providers.$inferSelect;

export async function getProviderByUser(ctx: AppContext, userId: string) {
  const [p] = await ctx.db.select().from(providers).where(eq(providers.userId, userId)).limit(1);
  return p ?? null;
}

export async function requireApprovedProvider(ctx: AppContext, userId: string) {
  const p = await getProviderByUser(ctx, userId);
  if (!p || p.status !== "approved") throw forbidden("approved provider required");
  return p;
}

export async function applyProvider(ctx: AppContext, userId: string, raw: unknown) {
  const input = providerApplyInput.parse(raw);
  if (await getProviderByUser(ctx, userId)) throw new AppError("conflict", "already applied");
  const meta = { userId, targetType: "provider" };
  const [p] = await ctx.db
    .insert(providers)
    .values({ id: newId("prv"), userId, name: await moderate(ctx, input.name, meta), description: input.description ? await moderate(ctx, input.description, meta) : "" })
    .returning();
  return p;
}

function placeDto(p: typeof places.$inferSelect) {
  return { id: p.id, kind: p.kind, districtKey: p.districtKey, name: p.name, description: p.description, roofColor: p.roofColor, slot: p.slot, realAddress: p.realAddress, online: p.online };
}

export async function createShop(ctx: AppContext, provider: ProviderRow, raw: unknown) {
  const input = shopInput.parse(raw);
  const meta = { userId: provider.userId, targetType: "shop" };
  const [{ c }] = await ctx.db.select({ c: count() }).from(places).where(and(eq(places.districtKey, input.districtKey), eq(places.kind, "shop")));
  const [p] = await ctx.db
    .insert(places)
    .values({
      id: newId("plc"),
      districtKey: input.districtKey,
      kind: "shop",
      name: await moderate(ctx, input.name, meta),
      description: input.description ? await moderate(ctx, input.description, meta) : "",
      roofColor: input.roofColor,
      slot: c + 1,
      providerId: provider.id,
      realAddress: input.online ? null : (input.realAddress ?? null),
      online: input.online,
      isDemo: provider.isDemo,
    })
    .returning();
  return placeDto(p);
}

async function ownShop(ctx: AppContext, provider: ProviderRow, placeId: string) {
  const [p] = await ctx.db.select().from(places).where(and(eq(places.id, placeId), eq(places.providerId, provider.id)));
  if (!p) throw notFound("shop");
  return p;
}

export async function updateShop(ctx: AppContext, provider: ProviderRow, placeId: string, raw: unknown) {
  const cur = await ownShop(ctx, provider, placeId);
  const input = shopInput.partial().parse(raw);
  const meta = { userId: provider.userId, targetType: "shop" };
  const [p] = await ctx.db
    .update(places)
    .set({
      name: input.name ? await moderate(ctx, input.name, meta) : cur.name,
      description: input.description === undefined ? cur.description : input.description ? await moderate(ctx, input.description, meta) : "",
      roofColor: input.roofColor ?? cur.roofColor,
      realAddress: input.online ? null : (input.realAddress ?? cur.realAddress),
      online: input.online ?? cur.online,
    })
    .where(eq(places.id, cur.id))
    .returning();
  return placeDto(p);
}

async function ownTrial(ctx: AppContext, provider: ProviderRow, trialId: string) {
  const [t] = await ctx.db.select().from(trials).where(and(eq(trials.id, trialId), eq(trials.providerId, provider.id)));
  if (!t) throw notFound("trial");
  return t;
}

async function moderatedTrialFields(ctx: AppContext, userId: string, input: Partial<ReturnType<typeof trialInput.parse>>) {
  const meta = { userId, targetType: "trial" };
  const out: Record<string, unknown> = { ...input };
  for (const k of ["title", "description", "whenText", "processInfo", "aiFirstStepHint", "selfFirstStepHint"] as const) {
    const v = input[k];
    if (typeof v === "string" && v) out[k] = await moderate(ctx, v, meta);
  }
  return out;
}

export async function createTrial(ctx: AppContext, provider: ProviderRow, raw: unknown) {
  const input = trialInput.parse(raw);
  await ownShop(ctx, provider, input.placeId);
  const fields = (await moderatedTrialFields(ctx, provider.userId, input)) as typeof input;
  const [t] = await ctx.db.insert(trials).values({ id: newId("trl"), providerId: provider.id, ...fields, isDemo: provider.isDemo }).returning();
  return trialDto(t);
}

export async function updateTrial(ctx: AppContext, provider: ProviderRow, trialId: string, raw: unknown) {
  await ownTrial(ctx, provider, trialId);
  const input = trialInput.partial().extend({ status: z.enum(["active", "archived"]).optional() }).parse(raw);
  if (input.placeId) await ownShop(ctx, provider, input.placeId);
  const { status, ...rest } = input;
  const fields = await moderatedTrialFields(ctx, provider.userId, rest);
  const [t] = await ctx.db.update(trials).set({ ...fields, ...(status ? { status } : {}) }).where(eq(trials.id, trialId)).returning();
  return trialDto(t);
}

export async function addFaq(ctx: AppContext, provider: ProviderRow, trialId: string, raw: unknown) {
  await ownTrial(ctx, provider, trialId);
  const input = faqInput.parse(raw);
  const meta = { userId: provider.userId, targetType: "faq" };
  const [f] = await ctx.db
    .insert(trialFaqs)
    .values({ id: newId("faq"), trialId, question: await moderate(ctx, input.question, meta), answer: await moderate(ctx, input.answer, meta) })
    .returning();
  return { id: f.id, question: f.question, answer: f.answer };
}

export async function deleteFaq(ctx: AppContext, provider: ProviderRow, faqId: string) {
  const [f] = await ctx.db.select({ id: trialFaqs.id }).from(trialFaqs).innerJoin(trials, eq(trials.id, trialFaqs.trialId)).where(and(eq(trialFaqs.id, faqId), eq(trials.providerId, provider.id)));
  if (!f) throw notFound("faq");
  await ctx.db.delete(trialFaqs).where(eq(trialFaqs.id, faqId));
}

export async function addSession(ctx: AppContext, provider: ProviderRow, trialId: string, raw: unknown) {
  await ownTrial(ctx, provider, trialId);
  const input = sessionInput.parse(raw);
  const [s] = await ctx.db.insert(trialSessions).values({ id: newId("ses"), trialId, startsAt: new Date(input.startsAt), capacity: input.capacity }).returning();
  return { id: s.id, startsAt: s.startsAt, capacity: s.capacity, remaining: s.capacity };
}

async function ownSession(ctx: AppContext, provider: ProviderRow, sessionId: string) {
  const [s] = await ctx.db
    .select({ session: trialSessions, trial: trials })
    .from(trialSessions)
    .innerJoin(trials, eq(trials.id, trialSessions.trialId))
    .where(and(eq(trialSessions.id, sessionId), eq(trials.providerId, provider.id)));
  if (!s) throw notFound("session");
  return s;
}

export async function listBookings(ctx: AppContext, provider: ProviderRow, sessionId: string) {
  await ownSession(ctx, provider, sessionId);
  const rows = await ctx.db
    .select({ id: bookings.id, characterName: characters.name, attendedAt: bookings.attendedAt })
    .from(bookings)
    .leftJoin(characters, eq(characters.userId, bookings.userId))
    .where(eq(bookings.sessionId, sessionId))
    .orderBy(asc(bookings.createdAt));
  return rows.map((r) => ({ ...r, characterName: r.characterName ?? "（尚未設定角色）" }));
}

export async function attendBooking(ctx: AppContext, provider: ProviderRow, bookingId: string) {
  const [b] = await ctx.db
    .select({ booking: bookings, trial: trials })
    .from(bookings)
    .innerJoin(trialSessions, eq(trialSessions.id, bookings.sessionId))
    .innerJoin(trials, eq(trials.id, trialSessions.trialId))
    .where(and(eq(bookings.id, bookingId), eq(trials.providerId, provider.id)));
  if (!b) throw notFound("booking");
  if (b.booking.attendedAt) return { id: b.booking.id, attendedAt: b.booking.attendedAt };
  const now = ctx.now();
  await ctx.db.update(bookings).set({ attendedAt: now }).where(eq(bookings.id, bookingId));
  await ctx.db.insert(trialEvents).values({ id: newId("tev"), trialId: b.trial.id, userId: b.booking.userId, kind: "attended" });
  let deedId: string | null = null;
  if (b.booking.firstStepId) {
    const [step] = await ctx.db.select().from(firstSteps).where(eq(firstSteps.id, b.booking.firstStepId));
    if (step?.status === "confirmed") {
      deedId = (await createDeedFromStep(ctx, step, { recordSource: "provider_confirmed", visibility: "public" })).id;
    } else if (step?.status === "done") {
      const [d] = await ctx.db.update(deeds).set({ recordSource: "provider_confirmed" }).where(eq(deeds.firstStepId, step.id)).returning();
      deedId = d?.id ?? null;
    }
    if (step) await notify(ctx, b.booking.userId, "attendance_confirmed", { stepId: step.id, deedId, trialTitle: b.trial.title });
  }
  return { id: b.booking.id, attendedAt: now, deedId };
}

export async function listQuestions(ctx: AppContext, provider: ProviderRow) {
  return ctx.db
    .select({ id: providerQuestions.id, trialId: providerQuestions.trialId, trialTitle: trials.title, question: providerQuestions.question, answer: providerQuestions.answer, createdAt: providerQuestions.createdAt })
    .from(providerQuestions)
    .innerJoin(trials, eq(trials.id, providerQuestions.trialId))
    .where(and(eq(trials.providerId, provider.id), eq(providerQuestions.source, "forwarded")))
    .orderBy(sql`${providerQuestions.answer} IS NOT NULL`, desc(providerQuestions.createdAt))
    .limit(100);
}

export async function answerQuestion(ctx: AppContext, provider: ProviderRow, questionId: string, raw: unknown) {
  const input = answerInput.parse(raw);
  const [q] = await ctx.db
    .select({ q: providerQuestions, trial: trials })
    .from(providerQuestions)
    .innerJoin(trials, eq(trials.id, providerQuestions.trialId))
    .where(and(eq(providerQuestions.id, questionId), eq(trials.providerId, provider.id)));
  if (!q) throw notFound("question");
  const answer = await moderate(ctx, input.answer, { userId: provider.userId, targetType: "answer" });
  await ctx.db.update(providerQuestions).set({ answer, answeredAt: ctx.now() }).where(eq(providerQuestions.id, questionId));
  if (input.addToFaq) await ctx.db.insert(trialFaqs).values({ id: newId("faq"), trialId: q.trial.id, question: q.q.question, answer });
  await notify(ctx, q.q.askerUserId, "question_answered", { trialId: q.trial.id, trialTitle: q.trial.title, question: q.q.question, answer, stepId: q.q.firstStepId });
  return { id: questionId, answer };
}

/** Demand signals and thanks for each of the provider's trials. Anonymous by design. */
export async function getSignals(ctx: AppContext, provider: ProviderRow) {
  const ts = await ctx.db.select().from(trials).where(eq(trials.providerId, provider.id)).orderBy(asc(trials.createdAt));
  if (!ts.length) return [];
  const ids = ts.map((t) => t.id);
  const ev = await ctx.db.select({ trialId: trialEvents.trialId, kind: trialEvents.kind, c: count() }).from(trialEvents).where(inArray(trialEvents.trialId, ids)).groupBy(trialEvents.trialId, trialEvents.kind);
  const qs = await ctx.db.select({ trialId: providerQuestions.trialId, question: providerQuestions.question, createdAt: providerQuestions.createdAt }).from(providerQuestions).where(inArray(providerQuestions.trialId, ids)).orderBy(desc(providerQuestions.createdAt));
  const ds = await ctx.db.select({ id: deeds.id, trialId: deeds.trialId, firstStepId: deeds.firstStepId }).from(deeds).where(inArray(deeds.trialId, ids));
  const fs = ds.length ? await ctx.db.select({ deedId: follows.deedId, c: count() }).from(follows).where(inArray(follows.deedId, ds.map((d) => d.id))).groupBy(follows.deedId) : [];
  const stepIds = ds.map((d) => d.firstStepId).filter((x): x is string => Boolean(x));
  const ns = stepIds.length ? await ctx.db.select().from(notes).where(and(inArray(notes.firstStepId, stepIds), eq(notes.shared, true))) : [];
  return ts.map((t) => {
    const e = (k: string) => ev.find((x) => x.trialId === t.id && x.kind === k)?.c ?? 0;
    const myDeeds = ds.filter((d) => d.trialId === t.id);
    const faqQuestions = qs.filter((q) => q.trialId === t.id).map((q) => q.question);
    return {
      trialId: t.id,
      title: t.title,
      aiViews: e("ai_view"),
      questions: e("question"),
      bookings: e("booking"),
      attended: e("attended"),
      deeds: myDeeds.length,
      follows: myDeeds.reduce((n, d) => n + (fs.find((f) => f.deedId === d.id)?.c ?? 0), 0),
      recentQuestions: faqQuestions.slice(0, 10),
      sharedNotes: myDeeds
        .map((d) => {
          const mine = ns.filter((n) => n.firstStepId === d.firstStepId);
          return { before: mine.find((n) => n.kind === "before")?.body ?? null, after: mine.find((n) => n.kind === "after")?.body ?? null };
        })
        .filter((n) => n.before || n.after),
    };
  });
}

export async function getProviderDashboard(ctx: AppContext, userId: string) {
  const provider = await getProviderByUser(ctx, userId);
  if (!provider) return { provider: null, shops: [], trials: [] };
  const shops = await ctx.db.select().from(places).where(eq(places.providerId, provider.id)).orderBy(asc(places.createdAt));
  const ts = await ctx.db.select().from(trials).where(eq(trials.providerId, provider.id)).orderBy(asc(trials.createdAt));
  const faqs = ts.length ? await ctx.db.select().from(trialFaqs).where(inArray(trialFaqs.trialId, ts.map((t) => t.id))) : [];
  const sessions = await upcomingSessions(ctx, ts.map((t) => t.id));
  const [unanswered] = await ctx.db
    .select({ c: count() })
    .from(providerQuestions)
    .innerJoin(trials, eq(trials.id, providerQuestions.trialId))
    .where(and(eq(trials.providerId, provider.id), isNull(providerQuestions.answer), eq(providerQuestions.source, "forwarded")));
  return {
    provider: { id: provider.id, name: provider.name, description: provider.description, status: provider.status },
    shops: shops.map(placeDto),
    trials: ts.map((t) => ({
      ...trialDto(t),
      faqs: faqs.filter((f) => f.trialId === t.id).map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
      sessions: sessions.filter((s) => s.trialId === t.id).map(({ trialId: _t, ...s }) => s),
    })),
    unansweredQuestions: unanswered.c,
  };
}
