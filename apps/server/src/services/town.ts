import { DISTRICTS } from "@lj/core";
import { characters, deeds, places, providers, trials } from "@lj/db";
import { and, count, eq, gte, isNotNull, ne, or, isNull } from "drizzle-orm";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";
import { listPublicDeeds, deedDto, visibleDeed } from "./deeds";
import { listTrialsForPlace } from "./trials";

const PRESENCE_DAYS = 7;
const PRESENCE_MAX = 5;

/** Shops of suspended providers are hidden. */
export const visiblePlace = () => or(eq(places.kind, "public"), eq(providers.status, "approved"));

export async function getTown(ctx: AppContext) {
  const rows = await ctx.db
    .select({ place: places, providerName: providers.name, providerStatus: providers.status })
    .from(places)
    .leftJoin(providers, eq(providers.id, places.providerId))
    .where(visiblePlace());
  const deedCounts = await ctx.db.select({ placeId: deeds.placeId, c: count() }).from(deeds).where(visibleDeed()).groupBy(deeds.placeId);
  const trialCounts = await ctx.db.select({ placeId: trials.placeId, c: count() }).from(trials).where(eq(trials.status, "active")).groupBy(trials.placeId);
  const since = new Date(ctx.now().getTime() - PRESENCE_DAYS * 86400_000);
  const present = await ctx.db
    .select({ placeId: characters.lastActivePlaceId, name: characters.name, appearance: characters.appearance, at: characters.lastActiveAt })
    .from(characters)
    .where(and(isNotNull(characters.lastActivePlaceId), gte(characters.lastActiveAt, since)));
  present.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  return {
    districts: DISTRICTS,
    places: rows.map(({ place, providerName }) => {
      const here = present.filter((p) => p.placeId === place.id);
      return {
        id: place.id,
        kind: place.kind,
        districtKey: place.districtKey,
        name: place.name,
        roofColor: place.roofColor,
        slot: place.slot,
        isDemo: place.isDemo,
        providerName: providerName ?? null,
        deedCount: deedCounts.find((d) => d.placeId === place.id)?.c ?? 0,
        trialCount: trialCounts.find((t) => t.placeId === place.id)?.c ?? 0,
        presence: { total: here.length, characters: here.slice(0, PRESENCE_MAX).map((p) => ({ name: p.name, appearance: p.appearance })) },
      };
    }),
  };
}

export async function getPlaceRow(ctx: AppContext, placeId: string) {
  const [row] = await ctx.db
    .select({ place: places, providerName: providers.name })
    .from(places)
    .leftJoin(providers, eq(providers.id, places.providerId))
    .where(and(eq(places.id, placeId), visiblePlace()))
    .limit(1);
  if (!row) throw notFound("place");
  return row;
}

export async function getPlace(ctx: AppContext, placeId: string, viewerId?: string) {
  const { place, providerName } = await getPlaceRow(ctx, placeId);
  const ds = await listPublicDeeds(ctx, eq(deeds.placeId, place.id), 40);
  return {
    id: place.id,
    kind: place.kind,
    districtKey: place.districtKey,
    name: place.name,
    description: place.description,
    roofColor: place.roofColor,
    realAddress: place.realAddress,
    online: place.online,
    isDemo: place.isDemo,
    providerName: providerName ?? null,
    deeds: ds.map((d) => ({ ...deedDto(d.deed), isMine: d.deed.userId === viewerId, character: d.characterName ? { name: d.characterName, appearance: d.appearance } : null })),
    trials: await listTrialsForPlace(ctx, place.id),
  };
}

export { ne, isNull };
