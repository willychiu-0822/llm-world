// Gives every E2E run an empty database; the server applies migrations on start.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || new URL(url).pathname !== "/longjiao_laned_e2e") throw new Error("Only the session D E2E database may be reset");
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await c.end();
console.log("e2e database reset");
