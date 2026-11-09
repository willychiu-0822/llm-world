import { bookings, deeds, firstSteps, follows, notes, places, trialSessions, trials, wants } from "@lj/db";
import { and, asc, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { AppContext } from "../context";

/** The achievement mirror: what you have actually done, not a score. */
export async function getMirror(ctx: AppContext, userId: string) {
  const myDeeds = await ctx.db
    .select({ deed: deeds, placeName: places.name, wantId: firstSteps.wantId })
    .from(deeds)
    .innerJoin(places, eq(places.id, deeds.placeId))
    .leftJoin(firstSteps, eq(firstSteps.id, deeds.firstStepId))
    .where(eq(deeds.userId, userId))
    .orderBy(asc(deeds.createdAt));

  const fp = new Map<string, { placeId: string; placeName: string; districtKey: string; firstAt: Date; count: number }>();
  for (const { deed, placeName } of myDeeds) {
    const cur = fp.get(deed.placeId);
    if (cur) cur.count++;
    else fp.set(deed.placeId, { placeId: deed.placeId, placeName, districtKey: deed.districtKey, firstAt: deed.createdAt, count: 1 });
  }
  const attendedPlaces = await ctx.db
    .select({ placeId: places.id, placeName: places.name, districtKey: places.districtKey, at: bookings.attendedAt })
    .from(bookings)
    .innerJoin(trialSessions, eq(trialSessions.id, bookings.sessionId))
    .innerJoin(trials, eq(trials.id, trialSessions.trialId))
    .innerJoin(places, eq(places.id, trials.placeId))
    .where(and(eq(bookings.userId, userId), isNotNull(bookings.attendedAt)));
  for (const a of attendedPlaces) if (!fp.has(a.placeId)) fp.set(a.placeId, { placeId: a.placeId, placeName: a.placeName, districtKey: a.districtKey, firstAt: a.at!, count: 1 });

  const ws = await ctx.db.select().from(wants).where(and(eq(wants.userId, userId), ne(wants.status, "dropped"))).orderBy(asc(wants.createdAt));
  const overlap = ws.map((w) => ({
    want: { id: w.id, text: w.text, districtKey: w.districtKey },
    deeds: myDeeds.filter((d) => d.wantId === w.id).map((d) => ({ id: d.deed.id, title: d.deed.title, executor: d.deed.executor })),
  }));

  const done = await ctx.db.select().from(firstSteps).where(and(eq(firstSteps.userId, userId), eq(firstSteps.status, "done"))).orderBy(asc(firstSteps.doneAt));
  const ns = done.length ? await ctx.db.select().from(notes).where(inArray(notes.firstStepId, done.map((s) => s.id))) : [];
  const notePairs = done
    .map((s) => ({
      stepId: s.id,
      text: s.text,
      before: ns.find((n) => n.firstStepId === s.id && n.kind === "before")?.body ?? null,
      after: ns.find((n) => n.firstStepId === s.id && n.kind === "after")?.body ?? null,
      doneAt: s.doneAt,
    }))
    .filter((p) => p.before || p.after);

  const fRows = myDeeds.length
    ? await ctx.db.select({ status: follows.status, c: count() }).from(follows).where(inArray(follows.deedId, myDeeds.map((d) => d.deed.id))).groupBy(follows.status)
    : [];
  const completed = fRows.find((r) => r.status === "completed")?.c ?? 0;
  return {
    footprints: [...fp.values()],
    overlap,
    notePairs,
    stats: {
      deeds: myDeeds.length,
      byExecutor: { ai: myDeeds.filter((d) => d.deed.executor === "ai").length, self: myDeeds.filter((d) => d.deed.executor === "self").length },
      followed: { referenced: completed + (fRows.find((r) => r.status === "referenced")?.c ?? 0), completed },
    },
  };
}
