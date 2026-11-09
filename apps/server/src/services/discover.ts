import { bringBackInput, rankCandidates, type Candidate } from "@lj/core";
import { characters, deeds, discoveries, discoverySeen, newId, places, providers, trials, wants } from "@lj/db";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";
import { visibleDeed } from "./deeds";
import { moderate } from "./moderation";

export interface DiscoverItem {
  type: "deed" | "trial";
  id: string;
  title: string;
  districtKey: string;
  placeId: string;
  placeName: string;
  isDemo: boolean;
  reasons: string[];
  executor?: string;
  characterName?: string | null;
  isFirst?: boolean;
  providerName?: string;
  durationMin?: number;
  whenText?: string;
}

/** Candidates for a user's character to discover, ranked by the rule-based curator. */
export async function discover(ctx: AppContext, userId: string, opts: { wantId?: string; limit?: number }) {
  const wantRows = await ctx.db
    .select()
    .from(wants)
    .where(and(eq(wants.userId, userId), opts.wantId ? eq(wants.id, opts.wantId) : eq(wants.status, "active")));
  if (opts.wantId && !wantRows.length) throw notFound("want");

  const deedRows = await ctx.db
    .select({ deed: deeds, characterName: characters.name, placeName: places.name })
    .from(deeds)
    .innerJoin(places, eq(places.id, deeds.placeId))
    .leftJoin(characters, eq(characters.userId, deeds.userId))
    .where(and(visibleDeed(), ne(deeds.userId, userId)))
    .orderBy(desc(deeds.createdAt))
    .limit(300);
  const trialRows = await ctx.db
    .select({ trial: trials, placeName: places.name, districtKey: places.districtKey, providerName: providers.name })
    .from(trials)
    .innerJoin(places, eq(places.id, trials.placeId))
    .innerJoin(providers, eq(providers.id, trials.providerId))
    .where(and(eq(trials.status, "active"), eq(providers.status, "approved"), ne(providers.userId, userId)))
    .limit(200);
  const seen = await ctx.db.select({ itemId: discoverySeen.itemId }).from(discoverySeen).where(eq(discoverySeen.userId, userId));

  type C = Candidate & { item: Omit<DiscoverItem, "reasons"> };
  const cands: C[] = [
    ...deedRows.map(({ deed, characterName, placeName }) => ({
      kind: "deed" as const,
      id: deed.id,
      districtKey: deed.districtKey,
      text: `${deed.title} ${deed.summary}`,
      createdAt: deed.createdAt,
      isDemo: deed.isDemo,
      ownerId: deed.userId,
      isFirst: deed.isFirst,
      item: { type: "deed" as const, id: deed.id, title: deed.title, districtKey: deed.districtKey, placeId: deed.placeId, placeName, isDemo: deed.isDemo, executor: deed.executor, characterName, isFirst: deed.isFirst },
    })),
    ...trialRows.map(({ trial, placeName, districtKey, providerName }) => ({
      kind: "trial" as const,
      id: trial.id,
      districtKey,
      text: `${trial.title} ${trial.description}`,
      createdAt: trial.createdAt,
      isDemo: trial.isDemo,
      durationMin: trial.durationMin,
      exitAnytime: trial.exitAnytime,
      item: { type: "trial" as const, id: trial.id, title: trial.title, districtKey, placeId: trial.placeId, placeName, isDemo: trial.isDemo, providerName, durationMin: trial.durationMin, whenText: trial.whenText },
    })),
  ];
  const ranked = rankCandidates(cands, { wants: wantRows.map((w) => ({ text: w.text, districtKey: w.districtKey })), seenIds: new Set(seen.map((s) => s.itemId)), selfUserId: userId, now: ctx.now() }, opts.limit ?? 12);
  return {
    wants: wantRows.map((w) => ({ id: w.id, text: w.text, districtKey: w.districtKey })),
    items: ranked.map((r) => ({ ...r.candidate.item, reasons: r.reasons }) as DiscoverItem),
  };
}

async function resolveItems(ctx: AppContext, userId: string, items: { type: string; id: string }[], strict: boolean) {
  const ids = (t: string) => items.filter((i) => i.type === t).map((i) => i.id);
  const ds = ids("deed").length
    ? await ctx.db.select({ deed: deeds, characterName: characters.name }).from(deeds).leftJoin(characters, eq(characters.userId, deeds.userId)).where(inArray(deeds.id, ids("deed")))
    : [];
  const ts = ids("trial").length
    ? await ctx.db.select({ trial: trials, districtKey: places.districtKey, providerStatus: providers.status }).from(trials).innerJoin(places, eq(places.id, trials.placeId)).innerJoin(providers, eq(providers.id, trials.providerId)).where(inArray(trials.id, ids("trial")))
    : [];
  const ps = ids("place").length ? await ctx.db.select().from(places).where(inArray(places.id, ids("place"))) : [];
  const out = [];
  for (const i of items) {
    if (i.type === "deed") {
      const d = ds.find((x) => x.deed.id === i.id);
      const ok = d && d.deed.moderationState !== "removed" && (d.deed.visibility === "public" || d.deed.userId === userId);
      if (ok) out.push({ type: "deed", id: i.id, title: d.deed.title, districtKey: d.deed.districtKey, isDemo: d.deed.isDemo, executor: d.deed.executor, characterName: d.characterName });
      else if (strict) throw notFound("deed");
    } else if (i.type === "trial") {
      const t = ts.find((x) => x.trial.id === i.id);
      if (t && t.trial.status === "active" && t.providerStatus === "approved") out.push({ type: "trial", id: i.id, title: t.trial.title, districtKey: t.districtKey, isDemo: t.trial.isDemo });
      else if (strict) throw notFound("trial");
    } else {
      const p = ps.find((x) => x.id === i.id);
      if (p) out.push({ type: "place", id: i.id, title: p.name, districtKey: p.districtKey, isDemo: p.isDemo });
      else if (strict) throw notFound("place");
    }
  }
  return out;
}

export async function bringBack(ctx: AppContext, userId: string, raw: unknown) {
  const input = bringBackInput.parse(raw);
  await resolveItems(ctx, userId, input.items, true);
  const message = await moderate(ctx, input.message, { userId, targetType: "discovery" });
  const [d] = await ctx.db.insert(discoveries).values({ id: newId("dsc"), userId, message, items: input.items, createdAt: ctx.now() }).returning();
  for (const i of input.items) await ctx.db.insert(discoverySeen).values({ userId, itemId: i.id }).onConflictDoNothing();
  return { id: d.id };
}

export async function listDiscoveries(ctx: AppContext, userId: string) {
  const rows = await ctx.db.select().from(discoveries).where(eq(discoveries.userId, userId)).orderBy(desc(discoveries.createdAt)).limit(50);
  return Promise.all(
    rows.map(async (r) => ({ id: r.id, message: r.message, readAt: r.readAt, createdAt: r.createdAt, items: await resolveItems(ctx, userId, r.items as { type: string; id: string }[], false) })),
  );
}

export async function readDiscovery(ctx: AppContext, userId: string, id: string) {
  z.string().parse(id);
  await ctx.db.update(discoveries).set({ readAt: ctx.now() }).where(and(eq(discoveries.id, id), eq(discoveries.userId, userId), isNull(discoveries.readAt)));
}
