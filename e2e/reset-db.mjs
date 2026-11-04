// Gives every E2E run an empty database; the server applies migrations on start.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await c.end();
console.log("e2e database reset");
