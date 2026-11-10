import { connect, migrateWithLock } from "@lj/db";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createContext } from "./context";

const config = loadConfig();
if (config.isProd && process.env.AUTH_DEV_LOGIN === "true") {
  console.warn("AUTH_DEV_LOGIN is ignored when NODE_ENV=production");
}
if (!config.webDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guess = [path.resolve(here, "../../web/dist"), path.resolve(here, "../web")].find((p) => existsSync(path.join(p, "index.html")));
  if (guess) config.webDist = guess;
}

async function applyMigrations(url: string): Promise<void> {
  if (process.env.SKIP_MIGRATIONS === "true") return;
  const retryable = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|Connection terminated|the database system is starting up|too many connections|sorry, too many clients/i;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await migrateWithLock(url);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!retryable.test(message) || attempt === 8) throw error;
      console.error(`database not ready (${message}); retry ${attempt}/8`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

const handle = connect(config.databaseUrl, { max: Number(process.env.DB_POOL_MAX ?? 5) });
await applyMigrations(config.databaseUrl);
const app = createApp(createContext({ db: handle.db, config }));
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`龍角鎮 listening on :${config.port} (${config.env}) base=${config.baseUrl} web=${config.webDist ?? "none"} devLogin=${config.devLogin}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => void handle.close().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
