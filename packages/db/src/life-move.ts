import { migrateLife, type LifeRecord, type LifeState } from "@lj/core";
import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { characters, lifeDays, lifeItems } from "./schema";

/** A database handle or an open transaction. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
type LegacyRow = Pick<typeof characters.$inferSelect, "id" | "sharing" | "lifeLegacy">;
type Entry = LifeState["days"][number]["entries"][number];

/** True while a character still carries the old `sharing.life` save. */
export function hasLegacyLife(sharing: unknown): boolean {
  return (
    !!sharing &&
    typeof sharing === "object" &&
    !Array.isArray(sharing) &&
    Object.prototype.hasOwnProperty.call(sharing, "life")
  );
}

/**
 * LW-15: moves one character's `sharing.life` into `life_days`, `life_items` and the life columns.
 * Call it inside a transaction with the character row locked.
 *
 * - Every readable day, entry and keepsake is copied, duplicates included.
 * - The original JSON is appended to `life_legacy` untouched, so parts this version cannot read are still there.
 * - A save that cannot be read safely (`canWrite` false) is left exactly where it is.
 * - If rows already exist (an older server instance wrote `sharing.life` again after the first move),
 *   only days, entries and keepsakes that are missing get added; the columns keep their current values.
 */
export async function moveLifeRecord(
  tx: DbOrTx,
  c: LegacyRow,
): Promise<{ moved: boolean; record: LifeRecord }> {
  const record = migrateLife(c.sharing);
  if (!hasLegacyLife(c.sharing) || !record.canWrite) return { moved: false, record };
  const { state } = record;
  const dayRows = await tx.select().from(lifeDays).where(eq(lifeDays.characterId, c.id));
  const itemRows = await tx.select().from(lifeItems).where(eq(lifeItems.characterId, c.id));
  const first = c.lifeLegacy == null && dayRows.length === 0 && itemRows.length === 0;
  if (first) {
    if (state.days.length)
      await tx.insert(lifeDays).values(
        state.days.map((d) => ({
          characterId: c.id,
          day: d.day,
          autonomous: d.autonomous,
          entries: d.entries,
        })),
      );
    if (state.inventory.length)
      await tx.insert(lifeItems).values(
        state.inventory.map((i) => ({
          characterId: c.id,
          activityId: i.activityId,
          earnedOn: i.earnedOn,
        })),
      );
  } else {
    const known = new Map(dayRows.map((r) => [r.day, { id: r.id, entries: r.entries as Entry[] }]));
    for (const d of state.days) {
      const row = known.get(d.day);
      if (!row) {
        const [made] = await tx
          .insert(lifeDays)
          .values({ characterId: c.id, day: d.day, autonomous: d.autonomous, entries: d.entries })
          .returning({ id: lifeDays.id });
        known.set(d.day, { id: made!.id, entries: d.entries });
        continue;
      }
      const missing = d.entries.filter(
        (e) => !row.entries.some((x) => x.activityId === e.activityId),
      );
      if (!missing.length) continue;
      row.entries = [...row.entries, ...missing];
      await tx.update(lifeDays).set({ entries: row.entries }).where(eq(lifeDays.id, row.id));
    }
    const owned = new Set(itemRows.map((r) => r.activityId));
    for (const i of state.inventory) {
      if (owned.has(i.activityId)) continue;
      owned.add(i.activityId);
      await tx
        .insert(lifeItems)
        .values({ characterId: c.id, activityId: i.activityId, earnedOn: i.earnedOn });
    }
  }
  await tx
    .update(characters)
    .set({
      sharing: sql`${characters.sharing} - 'life'`,
      lifeLegacy: sql`coalesce(${characters.lifeLegacy}, '[]'::jsonb) || jsonb_build_array(${JSON.stringify(record.raw)}::jsonb)`,
      ...(first
        ? {
            allowVisits: state.allowVisits,
            lifeOutfit: state.outfit,
            lifeDecoration: state.decoration,
          }
        : {}),
    })
    .where(eq(characters.id, c.id));
  return { moved: true, record };
}

/** One-time pass after schema migrations: moves every old save that can be read. Safe to run again. */
export async function moveAllLegacyLife(db: Db): Promise<{ moved: number; left: string[] }> {
  const rows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(sql`jsonb_exists(${characters.sharing}, 'life')`);
  let moved = 0;
  const left: string[] = [];
  for (const { id } of rows) {
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(characters).where(eq(characters.id, id)).for("update");
      if (!c || !hasLegacyLife(c.sharing)) return;
      if ((await moveLifeRecord(tx, c)).moved) moved += 1;
      else left.push(id);
    });
  }
  if (left.length)
    console.error("life move: saves left in place because they could not be read safely", {
      characterIds: left,
    });
  return { moved, left };
}
