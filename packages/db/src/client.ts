import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  pool: pg.Pool;
  close(): Promise<void>;
}

/**
 * node-pg 8.13+ treats sslmode=require as verify-full. Hosted Postgres URLs
 * (Neon, Render external, Railway) use libpq's meaning: encrypt, don't verify.
 * Rewrite those to sslmode=no-verify unless the URL already opts into strict
 * verification or libpq compatibility. Local URLs without sslmode are unchanged.
 */
export function normalizeDatabaseUrl(url: string): string {
  if (!/[?&]sslmode=(?:require|prefer|verify-ca)(?:&|$)/.test(url)) return url;
  if (/[?&]uselibpqcompat=true(?:&|$)/.test(url)) return url;
  return url.replace(/([?&])sslmode=(?:require|prefer|verify-ca)(?=&|$)/, "$1sslmode=no-verify");
}

export function connect(url: string, opts: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({ connectionString: normalizeDatabaseUrl(url), max: opts.max ?? 10 });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
