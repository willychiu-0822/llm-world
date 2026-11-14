// Gives every E2E run an empty database; the server applies migrations on start.
import pg from "pg";
import { assertE2eDatabase } from "./assert-e2e-database.mjs";

const url = process.env.DATABASE_URL;
assertE2eDatabase(url);
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await c.end();
console.log("e2e database reset");
