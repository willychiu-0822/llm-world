import { createModerator, keywordProvider, type Moderator } from "@lj/core";
import type { Db } from "@lj/db";
import type { Config } from "./config";
import { createGoogleClient, type GoogleClient } from "./auth/google";

export interface AppContext {
  db: Db;
  config: Config;
  moderator: Moderator;
  google: GoogleClient;
  now(): Date;
}

export function createContext(opts: { db: Db; config: Config; now?: () => Date }): AppContext {
  return {
    db: opts.db,
    config: opts.config,
    moderator: createModerator({ mode: opts.config.moderationMode, providers: [keywordProvider({ words: opts.config.moderationWords, category: "blocklist" })] }),
    google: createGoogleClient(opts.config),
    now: opts.now ?? (() => new Date()),
  };
}
