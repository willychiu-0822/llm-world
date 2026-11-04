import { connect, migrateWithLock } from "@lj/db";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createContext } from "./context";

const config = loadConfig();
if (!config.webDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guess = [path.resolve(here, "../../web/dist"), path.resolve(here, "../web")].find((p) => existsSync(path.join(p, "index.html")));
  if (guess) config.webDist = guess;
}
const handle = connect(config.databaseUrl, { max: Number(process.env.DB_POOL_MAX ?? 5) });
if (process.env.SKIP_MIGRATIONS !== "true") await migrateWithLock(config.databaseUrl);
const app = createApp(createContext({ db: handle.db, config }));
const server = app.listen(config.port, () => {
  console.log(`龍角鎮 listening on :${config.port} (${config.env}) base=${config.baseUrl} web=${config.webDist ?? "none"}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => void handle.close().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
