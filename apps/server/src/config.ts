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

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Public origin for OAuth, MCP and cookies. An explicit BASE_URL always wins.
 * Platform hostnames are only a fallback so a first deploy can come up before
 * a custom domain exists. Production never guesses localhost.
 */
export function resolveBaseUrl(env: Record<string, string | undefined>, port: number, isProd: boolean): string {
  const explicit = trimmed(env.BASE_URL).replace(/\/$/, "");
  if (explicit) return explicit;
  const render = trimmed(env.RENDER_EXTERNAL_URL).replace(/\/$/, "");
  if (render) return render;
  const railway = trimmed(env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (railway) return `https://${railway}`;
  const flyApp = trimmed(env.FLY_APP_NAME);
  if (isProd && flyApp) return `https://${flyApp}.fly.dev`;
  if (isProd) throw new Error("BASE_URL is required in production");
  return `http://localhost:${port}`;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const nodeEnv = (env.NODE_ENV as Config["env"]) ?? "development";
  const isProd = nodeEnv === "production";
  const port = Number(env.PORT ?? 8080);
  const baseUrl = resolveBaseUrl(env, port, isProd);
  const sessionSecret = env.SESSION_SECRET ?? (isProd ? "" : "dev-only-session-secret-change-me");
  if (isProd && sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters in production");
  const databaseUrl = trimmed(env.DATABASE_URL) || (isProd ? "" : "postgres://postgres:postgres@localhost:5432/longjiao_dev");
  if (isProd && !databaseUrl) throw new Error("DATABASE_URL is required in production");
  const mode = (env.MODERATION_MODE ?? "filter") as ModerationMode;
  if (!["off", "log", "filter", "block"].includes(mode)) throw new Error(`Invalid MODERATION_MODE: ${mode}`);
  return {
    env: nodeEnv,
    isProd,
    port,
    baseUrl,
    databaseUrl,
    sessionSecret,
    google: { clientId: env.GOOGLE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_CLIENT_SECRET ?? "" },
    adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    // Unset stays off. Production ignores the flag entirely, even when it is "true".
    devLogin: !isProd && env.AUTH_DEV_LOGIN === "true",
    moderationMode: mode,
    moderationWords: [...DEFAULT_BLOCKLIST, ...(env.MODERATION_WORDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)],
    webDist: env.WEB_DIST,
    mcpRateLimitPerMinute: Number(env.MCP_RATE_LIMIT_PER_MINUTE ?? 60),
  };
}
