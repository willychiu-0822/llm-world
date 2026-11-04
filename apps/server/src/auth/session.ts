import { newId, randomToken, sessions, sha256, users } from "@lj/db";
import { parse, serialize, type SerializeOptions } from "cookie";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

export const SESSION_COOKIE = "lj_sid";
const SESSION_DAYS = 30;

export function cookieOptions(ctx: AppContext, maxAgeSec: number): SerializeOptions {
  return { httpOnly: true, sameSite: "lax", secure: ctx.config.baseUrl.startsWith("https://"), path: "/", maxAge: maxAgeSec };
}

export function readCookie(req: Request, name: string): string | undefined {
  return parse(req.headers.cookie ?? "")[name];
}

export function setCookie(res: Response, name: string, value: string, opts: SerializeOptions) {
  res.append("Set-Cookie", serialize(name, value, opts));
}

export async function createSession(ctx: AppContext, res: Response, userId: string) {
  const token = randomToken();
  await ctx.db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(ctx.now().getTime() + SESSION_DAYS * 86400_000),
  });
  setCookie(res, SESSION_COOKIE, token, cookieOptions(ctx, SESSION_DAYS * 86400));
}

export async function destroySession(ctx: AppContext, req: Request, res: Response) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await ctx.db.delete(sessions).where(eq(sessions.id, sha256(token)));
  setCookie(res, SESSION_COOKIE, "", cookieOptions(ctx, 0));
}

export function loadSession(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) {
        const rows = await ctx.db
          .select({ id: users.id, email: users.email, displayName: users.displayName, roles: users.roles })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, ctx.now())))
          .limit(1);
        if (rows[0]) req.user = rows[0];
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError("unauthorized", "login required"));
  next();
}

export function requireRole(role: "admin" | "provider"): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError("unauthorized", "login required"));
    if (!req.user.roles.includes(role)) return next(new AppError("forbidden", `${role} role required`));
    next();
  };
}

export { newId };
