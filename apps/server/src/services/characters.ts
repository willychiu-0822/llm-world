import { characterInput, wantInput, wantUpdate } from "@lj/core";
import { characters, discoveries, newId, notifications, providers, wants } from "@lj/db";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";
import { moderate } from "./moderation";
import { getPetSummary } from "./pet";

export type CharacterRow = typeof characters.$inferSelect;

export function publicCharacter(c: Pick<CharacterRow, "name" | "appearance" | "personality"> | null | undefined) {
  if (!c) return null;
  return { name: c.name, appearance: c.appearance, personality: c.personality };
}

export async function getCharacter(ctx: AppContext, userId: string) {
  const [c] = await ctx.db.select().from(characters).where(eq(characters.userId, userId)).limit(1);
  return c ?? null;
}

export async function saveCharacter(ctx: AppContext, userId: string, raw: unknown) {
  const input = characterInput.parse(raw);
  const meta = { userId, targetType: "character" };
  const name = await moderate(ctx, input.name, meta);
  const personality = input.personality ? await moderate(ctx, input.personality, meta) : "";
  const description = input.appearance.description ? await moderate(ctx, input.appearance.description, meta) : "";
  const existing = await getCharacter(ctx, userId);
  const prevSharing = (existing?.sharing ?? {}) as Record<string, unknown>;
  const sharing = { ...prevSharing, ...input.sharing };
  const values = { name, personality, appearance: { ...input.appearance, description }, sharing };
  if (existing) {
    const [c] = await ctx.db.update(characters).set(values).where(eq(characters.id, existing.id)).returning();
    return c;
  }
  const [c] = await ctx.db.insert(characters).values({ id: newId("chr"), userId, ...values }).returning();
  return c;
}

export async function listWants(ctx: AppContext, userId: string) {
  return ctx.db
    .select({ id: wants.id, text: wants.text, districtKey: wants.districtKey, status: wants.status, createdAt: wants.createdAt })
    .from(wants)
    .where(and(eq(wants.userId, userId), ne(wants.status, "dropped")))
    .orderBy(asc(wants.createdAt));
}

export async function addWant(ctx: AppContext, userId: string, raw: unknown) {
  const input = wantInput.parse(raw);
  const text = await moderate(ctx, input.text, { userId, targetType: "want" });
  const [w] = await ctx.db.insert(wants).values({ id: newId("want"), userId, text, districtKey: input.districtKey }).returning();
  return w;
}

export async function updateWant(ctx: AppContext, userId: string, wantId: string, raw: unknown) {
  const input: z.infer<typeof wantUpdate> = wantUpdate.parse(raw);
  const set: Partial<typeof wants.$inferInsert> = {};
  if (input.text) set.text = await moderate(ctx, input.text, { userId, targetType: "want" });
  if (input.districtKey) set.districtKey = input.districtKey;
  if (input.status) set.status = input.status;
  const [w] = await ctx.db.update(wants).set(set).where(and(eq(wants.id, wantId), eq(wants.userId, userId))).returning();
  if (!w) throw notFound("want");
  return w;
}

export async function getWant(ctx: AppContext, userId: string, wantId: string) {
  const [w] = await ctx.db.select().from(wants).where(and(eq(wants.id, wantId), eq(wants.userId, userId))).limit(1);
  if (!w) throw notFound("want");
  return w;
}

export async function getMe(ctx: AppContext, user: { id: string; email: string; displayName: string; roles: string[] }) {
  const character = await getCharacter(ctx, user.id);
  const [provider] = await ctx.db.select({ id: providers.id, name: providers.name, status: providers.status }).from(providers).where(eq(providers.userId, user.id)).limit(1);
  const [n] = await ctx.db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  const [d] = await ctx.db.select({ c: count() }).from(discoveries).where(and(eq(discoveries.userId, user.id), isNull(discoveries.readAt)));
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles },
    character: character ? { id: character.id, name: character.name, appearance: character.appearance, personality: character.personality, sharing: character.sharing } : null,
    wants: await listWants(ctx, user.id),
    provider: provider ?? null,
    unread: { notifications: n.c, discoveries: d.c },
    pet: character ? await getPetSummary(ctx, user.id, character.sharing) : null,
  };
}
