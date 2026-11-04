import { migrateWithLock } from "@lj/db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
await migrateWithLock(url);
console.log("migrations applied");
