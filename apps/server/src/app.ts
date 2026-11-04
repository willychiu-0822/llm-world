import express from "express";
import helmet from "helmet";
import { loadSession } from "./auth/session";
import type { AppContext } from "./context";
import { errorHandler } from "./http/errors";
import { serveWeb } from "./web";
import { APP_NAME } from "@lj/core";
import { authRoutes } from "./routes/auth";
import { mcpRoutes } from "./mcp/route";
import { oauthRoutes } from "./oauth/routes";
import { meRoutes } from "./routes/me";
import { deedRoutes, discoveryRoutes, notificationRoutes, stepRoutes } from "./routes/steps";
import { adminRoutes, providerRoutes, worldRoutes } from "./routes/world";

export function createApp(ctx: AppContext) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(loadSession(ctx));
  app.get("/api/config", (_req, res) =>
    res.json({ appName: APP_NAME, devLogin: ctx.config.devLogin, googleLogin: Boolean(ctx.config.google.clientId), mcpUrl: `${ctx.config.baseUrl}/mcp` }),
  );
  app.use(authRoutes(ctx));
  const oauth = oauthRoutes(ctx);
  app.use(oauth.router);
  app.use(mcpRoutes(ctx, oauth.provider));
  app.use("/api/me", meRoutes(ctx));
  app.use("/api/first-steps", stepRoutes(ctx));
  app.use("/api/deeds", deedRoutes(ctx));
  app.use("/api/notifications", notificationRoutes(ctx));
  app.use("/api", worldRoutes(ctx));
  app.use("/api", discoveryRoutes(ctx));
  app.use("/api/provider", providerRoutes(ctx));
  app.use("/api/admin", adminRoutes(ctx));
  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "not_found", message: "route not found" } }));
  serveWeb(app, ctx.config.webDist);
  app.use(errorHandler);
  return app;
}
