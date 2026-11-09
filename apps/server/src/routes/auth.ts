import { randomToken } from "@lj/db";
import { Router } from "express";
import { z } from "zod";
import { cookieOptions, createSession, destroySession, readCookie, setCookie } from "../auth/session";
import type { AppContext } from "../context";
import { AppError, h, notFound } from "../http/errors";
import { upsertUser } from "../services/users";

const STATE_COOKIE = "lj_oauth_state";

export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function authRoutes(ctx: AppContext) {
  const r = Router();
  const redirectUri = `${ctx.config.baseUrl}/auth/google/callback`;

  r.get("/auth/google/start", (req, res) => {
    if (!ctx.config.google.clientId) {
      const q = new URLSearchParams({ error: "google_unavailable", next: safeNext(req.query.next) });
      res.redirect(302, `/login?${q}`);
      return;
    }
    const state = randomToken(16);
    const next = safeNext(req.query.next);
    setCookie(res, STATE_COOKIE, `${state}|${encodeURIComponent(next)}`, cookieOptions(ctx, 600));
    res.redirect(302, ctx.google.authUrl(state, redirectUri));
  });

  r.get(
    "/auth/google/callback",
    h(async (req, res) => {
      const [state, nextEnc] = (readCookie(req, STATE_COOKIE) ?? "").split("|");
      if (!state || req.query.state !== state || typeof req.query.code !== "string") throw new AppError("invalid_input", "invalid oauth state");
      const profile = await ctx.google.exchange(req.query.code, redirectUri);
      const user = await upsertUser(ctx, { email: profile.email, name: profile.name, googleSub: profile.sub });
      await createSession(ctx, res, user.id);
      setCookie(res, STATE_COOKIE, "", cookieOptions(ctx, 0));
      res.redirect(302, safeNext(decodeURIComponent(nextEnc ?? "/")));
    }),
  );

  r.post(
    "/api/auth/dev-login",
    h(async (req, res) => {
      if (!ctx.config.devLogin) throw notFound("route");
      const body = z.object({ email: z.string().email(), name: z.string().max(40).optional() }).parse(req.body);
      const user = await upsertUser(ctx, { email: body.email, name: body.name ?? body.email.split("@")[0] });
      await createSession(ctx, res, user.id);
      res.json({ ok: true });
    }),
  );

  r.post(
    "/api/auth/logout",
    h(async (req, res) => {
      await destroySession(ctx, req, res);
      res.status(204).end();
    }),
  );

  return r;
}
