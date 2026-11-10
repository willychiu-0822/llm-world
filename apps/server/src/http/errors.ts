import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export type ErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "moderation_blocked"
  | "rate_limited"
  | "step_not_confirmed"
  | "step_already_done";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  moderation_blocked: 422,
  step_not_confirmed: 409,
  step_already_done: 409,
  rate_limited: 429,
};

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string = code, public details?: unknown) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what = "resource") => new AppError("not_found", `${what} not found`);
export const forbidden = (msg = "forbidden") => new AppError("forbidden", msg);

/** Wrap async handlers so thrown errors reach the error middleware (Express 5 does this too, kept explicit). */
export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "invalid_input", message: "invalid input", details: err.issues } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_input", message: "invalid JSON" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "internal", message: "internal error" } });
};
