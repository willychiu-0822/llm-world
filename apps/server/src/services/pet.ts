import { growthStage, keepsakeFor, nextGrowthAt, petPatchInput, warmLine, type Sticker } from "@lj/core";
import { characters, deeds, firstSteps, places } from "@lj/db";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";
import { visibleDeed } from "./deeds";

export interface PetState {
  collectedDeedIds: string[];
  earnedAccessories: string[];
  lastWalkOn: string | null;
  lastKeepsakeId: string | null;
  letterDismissed: boolean;
  notify: boolean;
  moods: Record<string, Sticker | string>;
}

export function readPet(sharing: unknown): PetState {
  const s = (sharing ?? {}) as Record<string, unknown>;
  const moods = s.moods && typeof s.moods === "object" ? (s.moods as Record<string, string>) : {};
  return {
    collectedDeedIds: Array.isArray(s.collectedDeedIds) ? s.collectedDeedIds.filter((x): x is string => typeof x === "string") : [],
    earnedAccessories: Array.isArray(s.earnedAccessories) ? s.earnedAccessories.filter((x): x is string => typeof x === "string") : [],
    lastWalkOn: typeof s.lastWalkOn === "string" ? s.lastWalkOn : null,
    lastKeepsakeId: typeof s.lastKeepsakeId === "string" ? s.lastKeepsakeId : null,
    letterDismissed: s.letterDismissed === true,
    notify: s.notify !== false,
    moods,
  };
}

export function taipeiDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function sharingWith(current: unknown, pet: PetState) {
  return {
    ...((current ?? {}) as Record<string, unknown>),
    collectedDeedIds: pet.collectedDeedIds,
    earnedAccessories: pet.earnedAccessories,
    lastWalkOn: pet.lastWalkOn,
    lastKeepsakeId: pet.lastKeepsakeId,
    letterDismissed: pet.letterDismissed,
    notify: pet.notify,
    moods: pet.moods,
  };
}

async function ownCharacter(ctx: AppContext, userId: string) {
  const [c] = await ctx.db.select().from(characters).where(eq(characters.userId, userId)).limit(1);
  if (!c) throw new AppError("conflict", "先把小龍帶回家");
  return c;
}

async function countStars(ctx: AppContext, userId: string) {
  const [row] = await ctx.db.select({ c: count() }).from(firstSteps).where(and(eq(firstSteps.userId, userId), eq(firstSteps.status, "done")));
  return Number(row?.c ?? 0);
}

async function countCollected(ctx: AppContext, userId: string, ids: string[]) {
  if (!ids.length) return 0;
  const [row] = await ctx.db
    .select({ c: count() })
    .from(deeds)
    .where(and(visibleDeed(), ne(deeds.userId, userId), inArray(deeds.id, ids)));
  return Number(row?.c ?? 0);
}

async function countOthers(ctx: AppContext, userId: string) {
  const [row] = await ctx.db.select({ c: count() }).from(deeds).where(and(visibleDeed(), ne(deeds.userId, userId)));
  return Number(row?.c ?? 0);
}

export async function getPetSummary(ctx: AppContext, userId: string, sharing: unknown) {
  const pet = readPet(sharing);
  const stars = await countStars(ctx, userId);
  const stage = growthStage(stars);
  const [collected, total] = await Promise.all([countCollected(ctx, userId, pet.collectedDeedIds), countOthers(ctx, userId)]);
  return {
    stars,
    stage,
    nextAt: nextGrowthAt(stars),
    accessories: pet.earnedAccessories,
    canWalk: pet.lastWalkOn !== taipeiDay(ctx.now()),
    collected,
    total,
    letter: stage >= 2 && !pet.letterDismissed,
    notify: pet.notify,
  };
}

interface KeepsakeRow {
  deed: typeof deeds.$inferSelect;
  characterName: string | null;
  placeName: string | null;
}

async function otherDeeds(ctx: AppContext, userId: string): Promise<KeepsakeRow[]> {
  return ctx.db
    .select({ deed: deeds, characterName: characters.name, placeName: places.name })
    .from(deeds)
    .leftJoin(characters, eq(characters.userId, deeds.userId))
    .leftJoin(places, eq(places.id, deeds.placeId))
    .where(and(visibleDeed(), ne(deeds.userId, userId)))
    .orderBy(desc(deeds.createdAt))
    .limit(200);
}

function present(row: KeepsakeRow, collected: boolean, mood: string | null) {
  const kind = keepsakeFor(row.deed.districtKey);
  const base = {
    deedId: row.deed.id,
    districtKey: row.deed.districtKey,
    placeId: row.deed.placeId,
    placeName: row.placeName ?? "",
    object: kind.name,
    emoji: kind.emoji,
    collected,
    createdAt: row.deed.createdAt,
  };
  if (!collected) return base;
  const who = row.characterName ?? "一位鎮民";
  return { ...base, who, title: row.deed.title, warmLine: warmLine({ name: who, title: row.deed.title, districtKey: row.deed.districtKey }), mood };
}

export async function listKeepsakes(ctx: AppContext, userId: string) {
  const character = await ownCharacter(ctx, userId);
  const pet = readPet(character.sharing);
  const rows = await otherDeeds(ctx, userId);
  const have = new Set(pet.collectedDeedIds);
  const items = rows.map((row) => present(row, have.has(row.deed.id), pet.moods[row.deed.id] ?? null));
  const collected = items.filter((i) => i.collected).length;
  return { collected, total: items.length, items };
}

function pickIndex(seed: string, n: number) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n;
}

export async function walkOut(ctx: AppContext, userId: string) {
  const character = await ownCharacter(ctx, userId);
  const pet = readPet(character.sharing);
  const today = taipeiDay(ctx.now());
  if (pet.lastWalkOn === today) throw new AppError("conflict", "今天已經出門過了");
  const rows = await otherDeeds(ctx, userId);
  const fresh = rows.filter((row) => !pet.collectedDeedIds.includes(row.deed.id));
  if (!fresh.length) throw new AppError("conflict", "小龍翻了翻草叢，今天沒有新信物");
  const row = fresh[pickIndex(`${userId}:${today}:${ctx.now().getTime()}`, fresh.length)]!;
  const first = !pet.earnedAccessories.includes("backpack");
  pet.collectedDeedIds = [...pet.collectedDeedIds, row.deed.id];
  pet.lastWalkOn = today;
  pet.lastKeepsakeId = row.deed.id;
  if (first) pet.earnedAccessories = [...pet.earnedAccessories, "backpack"];
  await ctx.db
    .update(characters)
    .set({ sharing: sharingWith(character.sharing, pet), lastActivePlaceId: row.deed.placeId, lastActiveAt: ctx.now() })
    .where(eq(characters.id, character.id));
  const summary = await getPetSummary(ctx, userId, sharingWith(character.sharing, pet));
  return { keepsake: present(row, true, null), reward: first ? "backpack" : null, pet: summary };
}

export async function patchPet(ctx: AppContext, userId: string, raw: unknown) {
  const input = petPatchInput.parse(raw);
  const character = await ownCharacter(ctx, userId);
  const pet = readPet(character.sharing);
  if (input.notify !== undefined) pet.notify = input.notify;
  if (input.letterDismissed) pet.letterDismissed = true;
  if (input.mood) {
    if (!pet.collectedDeedIds.includes(input.mood.deedId)) throw new AppError("invalid_input", "這顆信物還沒撿到");
    pet.moods = { ...pet.moods, [input.mood.deedId]: input.mood.sticker };
  }
  const sharing = sharingWith(character.sharing, pet);
  await ctx.db.update(characters).set({ sharing }).where(eq(characters.id, character.id));
  return getPetSummary(ctx, userId, sharing);
}
