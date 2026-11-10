import { DISTRICTS } from "@lj/core";
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { places } from "./schema";

/** Every district has one public place; deeds without a provider land there. */
export async function ensureBasePlaces(db: Db): Promise<void> {
  for (const d of DISTRICTS) {
    await db
      .insert(places)
      .values({ id: d.publicPlaceId, districtKey: d.key, kind: "public", name: d.publicPlaceName, slot: 0, roofColor: d.color })
      .onConflictDoNothing();
  }
}

const TABLES = [
  "moderation_log", "oauth_tokens", "oauth_grants", "oauth_codes", "oauth_requests", "oauth_clients", "discovery_seen", "notifications",
  "follows", "trial_events", "provider_questions", "discoveries", "deeds", "bookings", "notes", "first_steps",
  "trial_sessions", "trial_faqs", "trials", "places", "providers", "wants", "characters", "sessions", "users",
];

/** Test helper: wipe all data and restore base places. */
export async function resetDatabase(db: Db): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  await ensureBasePlaces(db);
}
