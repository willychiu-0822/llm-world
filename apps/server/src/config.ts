import { DEFAULT_BLOCKLIST, type ModerationMode } from "@lj/core";

export interface Config {
  env: "development" | "test" | "production";
  isProd: boolean;
  port: number;
  baseUrl: string;
  databaseUrl: string;
  sessionSecret: string;
  google: { clientId: string; clientSecret: string };
  adminEmails: string[];
  devLogin: boolean;
  moderationMode: ModerationMode;
  moderationWords: string[];
  webDist?: string;
  mcpRateLimitPerMinute: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const nodeEnv = (env.NODE_ENV as Config["env"]) ?? "development";
  const isProd = nodeEnv === "production";
  const baseUrl = (env.BASE_URL ?? `http://localhost:${env.PORT ?? 8080}`).replace(/\/$/, "");
  const sessionSecret = env.SESSION_SECRET ?? (isProd ? "" : "dev-only-session-secret-change-me");
  if (isProd && sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters in production");
  const mode = (env.MODERATION_MODE ?? "filter") as ModerationMode;
  if (!["off", "log", "filter", "block"].includes(mode)) throw new Error(`Invalid MODERATION_MODE: ${mode}`);
  return {
    env: nodeEnv,
    isProd,
    port: Number(env.PORT ?? 8080),
    baseUrl,
    databaseUrl: env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_dev",
    sessionSecret,
    google: { clientId: env.GOOGLE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_CLIENT_SECRET ?? "" },
    adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    // Dev login is never available in production, whatever the flag says.
    devLogin: !isProd && env.AUTH_DEV_LOGIN === "true",
    moderationMode: mode,
    moderationWords: [...DEFAULT_BLOCKLIST, ...(env.MODERATION_WORDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)],
    webDist: env.WEB_DIST,
    mcpRateLimitPerMinute: Number(env.MCP_RATE_LIMIT_PER_MINUTE ?? 60),
  };
}
