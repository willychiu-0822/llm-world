import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { AppContext } from "../context";

/** Same sentence the web client already shows for `rate_limited`. */
export const REST_WRITE_LIMIT_MESSAGE = "一下子按太多次了。歇一口氣再試一次。";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * OAuth sign-in and callback POSTs. A burst of ordinary writes must not
 * keep someone from signing in, so these use their own counter.
 */
const OAUTH_SIGN_IN_PATHS = new Set([
  "/authorize",
  "/token",
  "/register",
  "/revoke",
  "/oauth/consent",
]);

function isMcp(path: string) {
  return path === "/mcp" || path.startsWith("/mcp/");
}

function isWrite(method: string) {
  return WRITE_METHODS.has(method);
}

function isOauthSignIn(path: string) {
  return OAUTH_SIGN_IN_PATHS.has(path);
}

/**
 * Per signed-in user, or per IP when there is no session.
 * The counter is in memory for this process only. There is no shared store
 * across instances. This service runs as a single instance for now.
 */
function writeLimiter(ctx: AppContext, count: (path: string) => boolean) {
  return rateLimit({
    windowMs: 60_000,
    limit: ctx.config.restWriteRateLimitPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !isWrite(req.method) || !count(req.path),
    keyGenerator: (req) =>
      req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "rate_limited", message: REST_WRITE_LIMIT_MESSAGE } });
    },
  });
}

/** REST writes. Reads, MCP, and OAuth sign-in POSTs are not counted. */
export function restWriteLimiter(ctx: AppContext) {
  return writeLimiter(ctx, (path) => !isMcp(path) && !isOauthSignIn(path));
}

/** Separate budget for OAuth sign-in and callback POSTs. Same limit, own counter. */
export function oauthSignInLimiter(ctx: AppContext) {
  return writeLimiter(ctx, isOauthSignIn);
}
