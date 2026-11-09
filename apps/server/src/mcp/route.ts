import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import type { AppContext } from "../context";
import { mcpResourceUrl, type LongjiaoOAuthProvider } from "../oauth/provider";
import { buildMcpServer } from "./server";

export function mcpRoutes(ctx: AppContext, provider: LongjiaoOAuthProvider) {
  const r = Router();
  const resource = new URL(mcpResourceUrl(ctx));
  const auth = requireBearerAuth({ verifier: provider, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource), expectedResource: resource });
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: ctx.config.mcpRateLimitPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.clientId ?? "anonymous",
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, res) => res.status(429).json({ jsonrpc: "2.0", error: { code: -32000, message: "rate limited" }, id: null }),
    skip: () => ctx.config.env === "test",
  });

  r.post("/mcp", auth, limiter, async (req, res, next) => {
    try {
      const userId = String(req.auth?.extra?.userId);
      const server = buildMcpServer(ctx, userId);
      // Stateless: one server + transport per request, so any Cloud Run instance can serve any call.
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      next(e);
    }
  });
  const notAllowed = (_req: unknown, res: { status(n: number): { json(v: unknown): void } }) =>
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  r.get("/mcp", auth, notAllowed);
  r.delete("/mcp", auth, notAllowed);
  return r;
}
