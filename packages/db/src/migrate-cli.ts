import { connect } from "./client";
import { runMigrations } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const h = connect(url, { max: 1 });
await runMigrations(h.db);
await h.close();
console.log("migrations applied");
