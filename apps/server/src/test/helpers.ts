import { connect, resetDatabase, runMigrations, type DbHandle } from "@lj/db";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app";
import { loadConfig, type Config } from "../config";
import { createContext, type AppContext } from "../context";

export interface TestEnv {
  app: Express;
  ctx: AppContext;
  handle: DbHandle;
}

let migrated = false;

/** Sets up a fresh database per test and returns a lazily-filled env object. */
export function useTestApp(overrides: Partial<Config> = {}): TestEnv {
  const env = {} as TestEnv;
  beforeAll(async () => {
    const config = { ...loadConfig({ ...process.env, NODE_ENV: "test", AUTH_DEV_LOGIN: "true", BASE_URL: "http://localhost:8080", ADMIN_EMAILS: "admin@example.com", SESSION_SECRET: "test-secret-test-secret-test-secret" }), ...overrides };
    env.handle = connect(config.databaseUrl, { max: 4 });
    if (!migrated) {
      await runMigrations(env.handle.db);
      migrated = true;
    }
    env.ctx = createContext({ db: env.handle.db, config });
    env.app = createApp(env.ctx);
  });
  beforeEach(async () => {
    await resetDatabase(env.handle.db);
  });
  afterAll(async () => {
    await env.handle?.close();
  });
  return env;
}

export async function login(app: Express, email: string, name = email.split("@")[0]) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/dev-login").send({ email, name });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const nova = {
  name: "Nova",
  appearance: { body: "round", accessory: "dragon_horns", main: "#F2C6A8", accent: "#A9C7DE", description: "背著吉他的街頭歌手" },
  personality: "外向、喜歡站上舞台",
  sharing: { allowAiQuotes: true },
};

export async function userWithCharacter(app: Express, email: string, character = nova) {
  const agent = await login(app, email);
  const res = await agent.put("/api/me/character").send({ ...character, name: character.name });
  if (res.status !== 200) throw new Error(`character failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
