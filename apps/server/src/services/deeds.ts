import { DISTRICT_BY_KEY, type DistrictKey } from "@lj/core";
import { characters, deeds, firstSteps, follows, newId, notes, places, trials, users, wants } from "@lj/db";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";
import { moderate } from "./moderation";
import { notify } from "./notifications";

export type DeedRow = typeof deeds.$inferSelect;
export type StepRow = typeof firstSteps.$inferSelect;

/** Trial shop → explicitly selected want → first referenced deed's district → 萬事屋. */
export async function placeForStep(ctx: AppContext, step: StepRow) {
  if (step.trialId) {
    const [t] = await ctx.db.select({ placeId: trials.placeId, districtKey: places.districtKey }).from(trials).innerJoin(places, eq(places.id, trials.placeId)).where(eq(trials.id, step.trialId));
    if (t) return { placeId: t.placeId, districtKey: t.districtKey };
  }
  if (step.wantId) {
    const [w] = await ctx.db.select({ districtKey: wants.districtKey }).from(wants).where(eq(wants.id, step.wantId));
    if (w) return { placeId: DISTRICT_BY_KEY[w.districtKey as DistrictKey].publicPlaceId, districtKey: w.districtKey };
  }
  if (step.sourceDeedIds.length) {
    const [source] = await ctx.db.select({ districtKey: deeds.districtKey }).from(deeds).where(eq(deeds.id, step.sourceDeedIds[0]));
    if (source) return { placeId: DISTRICT_BY_KEY[source.districtKey as DistrictKey].publicPlaceId, districtKey: source.districtKey };
  }
  return { placeId: "pub_misc", districtKey: "misc" };
}

export async function createDeedFromStep(
  ctx: AppContext,
  step: StepRow,
  opts: { recordSource: "self" | "ai" | "provider_confirmed"; visibility: "public" | "private"; summary?: string },
) {
  const { placeId, districtKey } = await placeForStep(ctx, step);
  const [prior] = await ctx.db.select({ c: count() }).from(deeds).where(and(eq(deeds.userId, step.userId), eq(deeds.districtKey, districtKey)));
  const [owner] = await ctx.db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, step.userId));
  const summary = opts.summary ? await moderate(ctx, opts.summary, { userId: step.userId, targetType: "deed" }) : "";
  const now = ctx.now();
  const [deed] = await ctx.db
    .insert(deeds)
    .values({
      id: newId("deed"),
      userId: step.userId,
      firstStepId: step.id,
      executor: step.executor,
      title: step.text,
      summary,
      districtKey,
      placeId,
      trialId: step.trialId,
      relatedDeedIds: step.sourceDeedIds,
      recordSource: opts.recordSource,
      visibility: opts.visibility,
      isFirst: prior.c === 0,
      isDemo: owner?.isDemo ?? false,
      createdAt: now,
    })
    .returning();
  await ctx.db.update(firstSteps).set({ status: "done", doneAt: now }).where(eq(firstSteps.id, step.id));
  await ctx.db.update(characters).set({ lastActivePlaceId: placeId, lastActiveAt: now }).where(eq(characters.userId, step.userId));

  const fol = await ctx.db.update(follows).set({ status: "completed" }).where(eq(follows.firstStepId, step.id)).returning();
  if (fol.length) {
    const sources = await ctx.db.select().from(deeds).where(inArray(deeds.id, fol.map((f) => f.deedId)));
    for (const s of sources) if (!s.isDemo && s.userId !== step.userId) await notify(ctx, s.userId, "followed_completed", { deedId: s.id, deedTitle: s.title });
  }
  return deed;
}

export function deedDto(d: DeedRow) {
  return {
    id: d.id,
    executor: d.executor,
    title: d.title,
    summary: d.summary,
    districtKey: d.districtKey,
    placeId: d.placeId,
    trialId: d.trialId,
    relatedDeedIds: d.relatedDeedIds,
    recordSource: d.recordSource,
    visibility: d.visibility,
    isFirst: d.isFirst,
    isDemo: d.isDemo,
    createdAt: d.createdAt,
  };
}

/** Public deeds that others may see. */
export const visibleDeed = () => and(eq(deeds.visibility, "public"), ne(deeds.moderationState, "removed"));

export async function getDeedRow(ctx: AppContext, deedId: string, viewerId?: string) {
  const [d] = await ctx.db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
  if (!d || d.moderationState === "removed") throw notFound("deed");
  if (d.visibility !== "public" && d.userId !== viewerId) throw notFound("deed");
  return d;
}

export async function getDeedView(ctx: AppContext, deedId: string, viewerId?: string, opts: { forAi?: boolean } = {}) {
  const d = await getDeedRow(ctx, deedId, viewerId);
  const [c] = await ctx.db.select().from(characters).where(eq(characters.userId, d.userId)).limit(1);
  const [place] = await ctx.db.select({ id: places.id, name: places.name, districtKey: places.districtKey }).from(places).where(eq(places.id, d.placeId));
  const [trial] = d.trialId ? await ctx.db.select({ id: trials.id, title: trials.title }).from(trials).where(eq(trials.id, d.trialId)) : [];
  const isMine = d.userId === viewerId;
  const allowQuotes = !opts.forAi || ((c?.sharing as { allowAiQuotes?: boolean } | undefined)?.allowAiQuotes ?? true);
  const sharedNotes: { before?: string; after?: string } = {};
  if (d.firstStepId && allowQuotes) {
    const ns = await ctx.db.select().from(notes).where(and(eq(notes.firstStepId, d.firstStepId), eq(notes.shared, true)));
    for (const n of ns) sharedNotes[n.kind as "before" | "after"] = n.body;
  }
  const related = d.relatedDeedIds.length
    ? await ctx.db.select({ id: deeds.id, title: deeds.title }).from(deeds).where(and(inArray(deeds.id, d.relatedDeedIds), visibleDeed()))
    : [];
  let followers: { referenced: number; completed: number } | undefined;
  if (isMine) {
    const rows = await ctx.db.select({ status: follows.status, c: count() }).from(follows).where(eq(follows.deedId, d.id)).groupBy(follows.status);
    const by = Object.fromEntries(rows.map((r) => [r.status, r.c]));
    followers = { referenced: (by.referenced ?? 0) + (by.completed ?? 0), completed: by.completed ?? 0 };
  }
  return {
    ...deedDto(d),
    character: c ? { name: c.name, appearance: c.appearance } : null,
    place: place ?? null,
    trial: trial ?? null,
    sharedNotes,
    related,
    isMine,
    ...(followers ? { followers } : {}),
  };
}

export async function setDeedVisibility(ctx: AppContext, userId: string, deedId: string, visibility: "public" | "private") {
  const [d] = await ctx.db.update(deeds).set({ visibility }).where(and(eq(deeds.id, deedId), eq(deeds.userId, userId))).returning();
  if (!d) throw notFound("deed");
  return deedDto(d);
}

export async function listPublicDeeds(ctx: AppContext, where: ReturnType<typeof and>, limit = 30) {
  return ctx.db
    .select({ deed: deeds, characterName: characters.name, appearance: characters.appearance })
    .from(deeds)
    .leftJoin(characters, eq(characters.userId, deeds.userId))
    .where(and(visibleDeed(), where))
    .orderBy(deeds.isDemo, desc(deeds.createdAt))
    .limit(limit);
}
