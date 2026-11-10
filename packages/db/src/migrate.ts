import { existsSync } from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeDatabaseUrl, type Db } from "./client";
import { ensureBasePlaces } from "./base";

export function migrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../migrations"),
    path.resolve(here, "../../packages/db/migrations"),
    path.resolve(process.cwd(), "packages/db/migrations"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "meta", "_journal.json"))) ?? candidates[0];
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
  await ensureBasePlaces(db);
}

/**
 * Takes a Postgres advisory lock so several instances starting at once
 * apply migrations exactly once. Safe to run on every boot.
 */
export async function migrateWithLock(url: string): Promise<void> {
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("./schema");
  const client = new pg.Client({ connectionString: normalizeDatabaseUrl(url) });
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
