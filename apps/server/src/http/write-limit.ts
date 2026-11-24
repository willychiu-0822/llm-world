import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { AppContext } from "../context";

/** Same sentence the web client already shows for `rate_limited`. */
export const REST_WRITE_LIMIT_MESSAGE = "一下子按太多次了。歇一口氣再試一次。";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMcp(path: string) {
  return path === "/mcp" || path.startsWith("/mcp/");
}

/** Per signed-in user, or per IP when there is no session. Reads and MCP are not counted. */
export function restWriteLimiter(ctx: AppContext) {
  return rateLimit({
    windowMs: 60_000,
    limit: ctx.config.restWriteRateLimitPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !WRITE_METHODS.has(req.method) || isMcp(req.path),
    keyGenerator: (req) =>
      req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "rate_limited", message: REST_WRITE_LIMIT_MESSAGE } });
    },
  });
}
