import { connect, runMigrations } from "@lj/db";
import { loadConfig } from "./config";
import { createContext } from "./context";
import { purgeDemo } from "./services/admin";
import { seedDemo } from "./seed/demo";

const config = loadConfig();
const handle = connect(config.databaseUrl, { max: 2 });
await runMigrations(handle.db);
const ctx = createContext({ db: handle.db, config });
if (process.argv.includes("--purge")) console.log("purged", await purgeDemo(ctx));
else console.log((await seedDemo(ctx)).created ? "demo content created" : "demo content already exists");
await handle.close();
