import express from "express";
import helmet from "helmet";
import { loadSession } from "./auth/session";
import type { AppContext } from "./context";
import { errorHandler } from "./http/errors";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { deedRoutes, notificationRoutes, stepRoutes } from "./routes/steps";

export function createApp(ctx: AppContext) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(loadSession(ctx));
  app.use(authRoutes(ctx));
  app.use("/api/me", meRoutes(ctx));
  app.use("/api/first-steps", stepRoutes(ctx));
  app.use("/api/deeds", deedRoutes(ctx));
  app.use("/api/notifications", notificationRoutes(ctx));
  app.use("/api", (_req, res) => res.status(404).json({ error: { code: "not_found", message: "route not found" } }));
  app.use(errorHandler);
  return app;
}
