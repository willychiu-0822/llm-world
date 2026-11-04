import { aiProposeInput, buildIcs, completeStepInput, firstStepInput, noteInput } from "@lj/core";
import { bookings, characters, deeds, firstSteps, follows, newId, notes, places, providers, trialEvents, trialSessions, trials } from "@lj/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { getWant } from "./characters";
import { createDeedFromStep, deedDto, listPublicDeeds, type StepRow } from "./deeds";
import { moderate } from "./moderation";
import { notify } from "./notifications";

const STATUS = z.enum(["draft", "confirmed", "done", "dropped"]);

async function getOwnStep(ctx: AppContext, userId: string, stepId: string) {
  const [s] = await ctx.db.select().from(firstSteps).where(and(eq(firstSteps.id, stepId), eq(firstSteps.userId, userId))).limit(1);
  if (!s) throw notFound("first step");
  return s;
}

/** A trial may be used only while it is active and its provider is approved. */
export async function getUsableTrial(ctx: AppContext, trialId: string) {
  const [t] = await ctx.db
    .select({ trial: trials, providerStatus: providers.status, place: places })
    .from(trials)
    .innerJoin(providers, eq(providers.id, trials.providerId))
    .innerJoin(places, eq(places.id, trials.placeId))
    .where(eq(trials.id, trialId))
    .limit(1);
  if (!t || t.trial.status !== "active" || t.providerStatus !== "approved") throw new AppError("invalid_input", "trial not available");
  return t;
}

async function validateSources(ctx: AppContext, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows = await ctx.db.select().from(deeds).where(inArray(deeds.id, unique));
  for (const id of unique) {
    const d = rows.find((r) => r.id === id);
    if (!d || d.visibility !== "public" || d.moderationState === "removed") throw new AppError("invalid_input", "source deed not available");
    if (d.userId === userId) throw new AppError("invalid_input", "cannot reference your own deed");
  }
  return unique;
}

async function checkBookable(ctx: AppContext, userId: string, sessionId: string) {
  const [session] = await ctx.db.select().from(trialSessions).where(eq(trialSessions.id, sessionId));
  if (!session) throw notFound("session");
  const [taken] = await ctx.db.select({ c: count() }).from(bookings).where(eq(bookings.sessionId, session.id));
  if (taken.c >= session.capacity) throw new AppError("conflict", "session is full");
  const [mine] = await ctx.db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.sessionId, session.id), eq(bookings.userId, userId)));
  if (mine) throw new AppError("conflict", "already booked");
  return session;
}

async function book(ctx: AppContext, userId: string, step: StepRow) {
  if (!step.sessionId || step.executor !== "self") return;
  const session = await checkBookable(ctx, userId, step.sessionId);
  const inserted = await ctx.db
    .insert(bookings)
    .values({ id: newId("bkg"), sessionId: session.id, userId, firstStepId: step.id })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) throw new AppError("conflict", "already booked");
  await ctx.db.insert(trialEvents).values({ id: newId("tev"), trialId: session.trialId, userId, kind: "booking" });
}

/** Side effects of a step becoming real: follows (with thanks) and bookings. */
async function onConfirmed(ctx: AppContext, step: StepRow) {
  await book(ctx, step.userId, step);
  if (step.sourceDeedIds.length) {
    const sources = await ctx.db.select().from(deeds).where(inArray(deeds.id, step.sourceDeedIds));
    for (const s of sources) {
      await ctx.db.insert(follows).values({ id: newId("fol"), deedId: s.id, followerUserId: step.userId, firstStepId: step.id }).onConflictDoNothing();
      if (!s.isDemo && s.userId !== step.userId) await notify(ctx, s.userId, "followed_referenced", { deedId: s.id, deedTitle: s.title });
    }
  }
}

export async function createStep(
  ctx: AppContext,
  userId: string,
  raw: unknown,
  opts: { proposedBy: "user" | "ai"; reason?: string } = { proposedBy: "user" },
) {
  const input = firstStepInput.parse(raw);
  if (input.wantId) await getWant(ctx, userId, input.wantId);
  const sourceDeedIds = await validateSources(ctx, userId, input.sourceDeedIds);
  let trialId = input.trialId;
  if (input.sessionId) {
    const [s] = await ctx.db.select().from(trialSessions).where(eq(trialSessions.id, input.sessionId));
    if (!s || (trialId && s.trialId !== trialId)) throw new AppError("invalid_input", "session does not belong to the trial");
    trialId = s.trialId;
  }
  if (trialId) await getUsableTrial(ctx, trialId);
  if (input.sessionId && input.executor === "self" && opts.proposedBy === "user") await checkBookable(ctx, userId, input.sessionId);
  const text = await moderate(ctx, input.text, { userId, targetType: "first_step" });
  const now = ctx.now();
  const status = opts.proposedBy === "ai" ? "draft" : "confirmed";
  const [step] = await ctx.db
    .insert(firstSteps)
    .values({
      id: newId("stp"),
      userId,
      wantId: input.wantId ?? null,
      executor: input.executor,
      text,
      status,
      proposedBy: opts.proposedBy,
      proposalReason: opts.reason ?? null,
      sourceDeedIds,
      trialId: trialId ?? null,
      sessionId: input.executor === "self" ? (input.sessionId ?? null) : null,
      plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
      whereText: input.where ?? null,
      createdAt: now,
      confirmedAt: status === "confirmed" ? now : null,
    })
    .returning();
  if (input.noteBefore) await upsertNote(ctx, userId, step.id, "before", { body: input.noteBefore, shared: false });
  if (status === "confirmed") {
    try {
      await onConfirmed(ctx, step);
    } catch (e) {
      await ctx.db.delete(firstSteps).where(eq(firstSteps.id, step.id));
      throw e;
    }
  }
  return stepDto(step);
}

export async function proposeStep(ctx: AppContext, userId: string, raw: unknown) {
  const input = aiProposeInput.parse(raw);
  const step = await createStep(ctx, userId, { executor: input.executor, text: input.text, wantId: input.wantId, sourceDeedIds: input.sourceDeedIds, trialId: input.trialId }, { proposedBy: "ai", reason: input.reason });
  await notify(ctx, userId, "step_proposed", { stepId: step.id, text: step.text });
  return step;
}

export async function confirmStep(ctx: AppContext, userId: string, stepId: string) {
  const s = await getOwnStep(ctx, userId, stepId);
  if (s.status !== "draft") throw new AppError("conflict", "step is not a draft");
  const [step] = await ctx.db.update(firstSteps).set({ status: "confirmed", confirmedAt: ctx.now() }).where(eq(firstSteps.id, s.id)).returning();
  await onConfirmed(ctx, step);
  return stepDto(step);
}

export async function dropStep(ctx: AppContext, userId: string, stepId: string) {
  const s = await getOwnStep(ctx, userId, stepId);
  if (s.status === "done") throw new AppError("conflict", "step is already done");
  const [step] = await ctx.db.update(firstSteps).set({ status: "dropped" }).where(eq(firstSteps.id, s.id)).returning();
  return stepDto(step);
}

export async function completeSelfStep(ctx: AppContext, userId: string, stepId: string, raw: unknown) {
  const input = completeStepInput.parse(raw);
  const s = await getOwnStep(ctx, userId, stepId);
  if (s.executor !== "self") throw new AppError("step_not_confirmed", "AI steps are completed by your AI");
  if (s.status !== "confirmed") throw new AppError("step_not_confirmed", "step must be confirmed and not done");
  if (input.noteAfter) await upsertNote(ctx, userId, s.id, "after", { body: input.noteAfter, shared: input.noteShared });
  const [attended] = s.sessionId
    ? await ctx.db.select().from(bookings).where(and(eq(bookings.firstStepId, s.id), eq(bookings.userId, userId)))
    : [];
  const deed = await createDeedFromStep(ctx, s, { recordSource: attended?.attendedAt ? "provider_confirmed" : "self", visibility: input.visibility });
  return { step: stepDto({ ...s, status: "done" }), deed: deedDto(deed) };
}

export async function completeAiStep(ctx: AppContext, userId: string, stepId: string, result: string) {
  const s = await getOwnStep(ctx, userId, stepId);
  if (s.executor !== "ai") throw new AppError("invalid_input", "this step is for the person, not the AI");
  if (s.status !== "confirmed") throw new AppError("step_not_confirmed", "the user has not confirmed this step yet");
  const deed = await createDeedFromStep(ctx, s, { recordSource: "ai", visibility: "public", summary: result });
  await ctx.db.update(firstSteps).set({ result: deed.summary }).where(eq(firstSteps.id, s.id));
  await notify(ctx, userId, "ai_step_done", { stepId: s.id, deedId: deed.id, text: s.text });
  return deedDto(deed);
}

export async function upsertNote(ctx: AppContext, userId: string, stepId: string, kind: string, raw: unknown) {
  const k = z.enum(["before", "after"]).parse(kind);
  const input = noteInput.parse(raw);
  await getOwnStep(ctx, userId, stepId);
  const body = input.shared && input.body ? await moderate(ctx, input.body, { userId, targetType: "note" }) : input.body;
  const [n] = await ctx.db
    .insert(notes)
    .values({ id: newId("note"), firstStepId: stepId, kind: k, body, shared: input.shared, createdAt: ctx.now() })
    .onConflictDoUpdate({ target: [notes.firstStepId, notes.kind], set: { body, shared: input.shared } })
    .returning();
  return { kind: n.kind, body: n.body, shared: n.shared };
}

export function stepDto(s: StepRow) {
  return {
    id: s.id,
    executor: s.executor,
    text: s.text,
    status: s.status,
    proposedBy: s.proposedBy,
    proposalReason: s.proposalReason,
    wantId: s.wantId,
    sourceDeedIds: s.sourceDeedIds,
    trialId: s.trialId,
    sessionId: s.sessionId,
    plannedAt: s.plannedAt,
    where: s.whereText,
    result: s.result,
    createdAt: s.createdAt,
    doneAt: s.doneAt,
  };
}

export async function listSteps(ctx: AppContext, userId: string, status?: unknown, executor?: "ai" | "self") {
  const conds = [eq(firstSteps.userId, userId)];
  if (status !== undefined) conds.push(eq(firstSteps.status, STATUS.parse(status)));
  if (executor) conds.push(eq(firstSteps.executor, executor));
  const rows = await ctx.db.select().from(firstSteps).where(and(...conds)).orderBy(desc(firstSteps.createdAt)).limit(100);
  if (!rows.length) return [];
  const ns = await ctx.db.select().from(notes).where(inArray(notes.firstStepId, rows.map((r) => r.id)));
  const ds = await ctx.db.select({ id: deeds.id, firstStepId: deeds.firstStepId }).from(deeds).where(inArray(deeds.firstStepId, rows.map((r) => r.id)));
  const ts = rows.some((r) => r.trialId)
    ? await ctx.db.select({ id: trials.id, title: trials.title, placeId: trials.placeId }).from(trials).where(inArray(trials.id, rows.filter((r) => r.trialId).map((r) => r.trialId!)))
    : [];
  const ss = rows.some((r) => r.sessionId)
    ? await ctx.db.select().from(trialSessions).where(inArray(trialSessions.id, rows.filter((r) => r.sessionId).map((r) => r.sessionId!)))
    : [];
  const bs = await ctx.db.select().from(bookings).where(inArray(bookings.firstStepId, rows.map((r) => r.id)));
  return rows.map((r) => {
    const mine = ns.filter((n) => n.firstStepId === r.id);
    const toNote = (k: string) => {
      const n = mine.find((x) => x.kind === k);
      return n ? { body: n.body, shared: n.shared } : null;
    };
    const session = ss.find((x) => x.id === r.sessionId);
    const booking = bs.find((b) => b.firstStepId === r.id);
    return {
      ...stepDto(r),
      notes: { before: toNote("before"), after: toNote("after") },
      deedId: ds.find((d) => d.firstStepId === r.id)?.id ?? null,
      trial: ts.find((t) => t.id === r.trialId) ?? null,
      session: session ? { id: session.id, startsAt: session.startsAt } : null,
      attended: Boolean(booking?.attendedAt),
    };
  });
}

export async function stepIcs(ctx: AppContext, userId: string, stepId: string) {
  const s = await getOwnStep(ctx, userId, stepId);
  let start = s.plannedAt;
  let duration = 60;
  let location = s.whereText ?? "";
  let description = "龍角鎮的第一步";
  if (s.sessionId) {
    const [x] = await ctx.db
      .select({ startsAt: trialSessions.startsAt, durationMin: trials.durationMin, title: trials.title, address: places.realAddress, online: places.online, placeName: places.name, processInfo: trials.processInfo })
      .from(trialSessions)
      .innerJoin(trials, eq(trials.id, trialSessions.trialId))
      .innerJoin(places, eq(places.id, trials.placeId))
      .where(eq(trialSessions.id, s.sessionId));
    if (x) {
      start = x.startsAt;
      duration = x.durationMin;
      location = x.online ? "線上" : (x.address ?? x.placeName);
      description = x.processInfo || description;
    }
  }
  if (!start) throw new AppError("invalid_input", "this step has no planned time");
  const [c] = await ctx.db.select({ name: characters.name }).from(characters).where(eq(characters.userId, userId));
  return buildIcs({
    uid: `${s.id}@longjiao`,
    title: s.text,
    description: c ? `${c.name}：${description}` : description,
    location,
    start,
    durationMin: duration,
    alarmMinutesBefore: 30,
  });
}

export async function getSuggestions(ctx: AppContext, userId: string, q: { deedId?: string; trialId?: string }) {
  const predecessors: { deedId: string; text: string; executor: string; characterName: string | null; isDemo: boolean }[] = [];
  let hints: { ai: string; self: string } | null = null;
  let trialId = q.trialId;
  if (q.deedId) {
    const rows = await listPublicDeeds(ctx, eq(deeds.id, q.deedId), 1);
    const d = rows[0];
    if (!d) throw notFound("deed");
    predecessors.push({ deedId: d.deed.id, text: d.deed.title, executor: d.deed.executor, characterName: d.characterName, isDemo: d.deed.isDemo });
    trialId = trialId ?? d.deed.trialId ?? undefined;
  }
  if (trialId) {
    const [t] = await ctx.db.select().from(trials).where(eq(trials.id, trialId));
    if (t) hints = { ai: t.aiFirstStepHint, self: t.selfFirstStepHint };
    const more = await listPublicDeeds(ctx, eq(deeds.trialId, trialId), 10);
    for (const m of more) {
      if (m.deed.userId === userId || predecessors.some((p) => p.deedId === m.deed.id)) continue;
      predecessors.push({ deedId: m.deed.id, text: m.deed.title, executor: m.deed.executor, characterName: m.characterName, isDemo: m.deed.isDemo });
    }
  }
  return { predecessors: predecessors.slice(0, 6), hints };
}
