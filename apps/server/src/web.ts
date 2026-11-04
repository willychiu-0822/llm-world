import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";

const NOT_SPA = /^\/(api|auth|oauth|mcp|\.well-known|authorize|token|register|revoke|healthz)(\/|$)/;

/** Serves the built React app, with index.html as the fallback for client-side routes. */
export function serveWeb(app: Express, dist: string | undefined) {
  if (!dist || !existsSync(path.join(dist, "index.html"))) return;
  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/.*/, (req, res, next) => {
    if (NOT_SPA.test(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}
