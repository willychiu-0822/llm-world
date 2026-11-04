import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Db } from "./client";
import { ensureBasePlaces } from "./base";

export function migrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../migrations");
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
  await ensureBasePlaces(db);
}

/**
 * Production migration: takes a Postgres advisory lock so that several Cloud Run
 * instances starting at once apply migrations exactly once.
 */
export async function migrateWithLock(url: string): Promise<void> {
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("./schema");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(727272)");
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    await ensureBasePlaces(db as unknown as Db);
  } finally {
    await client.query("SELECT pg_advisory_unlock(727272)").catch(() => {});
    await client.end();
  }
}
