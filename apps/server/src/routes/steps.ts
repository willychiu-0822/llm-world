import { deedVisibilityInput } from "@lj/core";
import { Router } from "express";
import { requireUser } from "../auth/session";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { getDeedView, setDeedVisibility } from "../services/deeds";
import { listNotifications, readAllNotifications } from "../services/notifications";
import { completeSelfStep, confirmStep, createStep, dropStep, getSuggestions, listSteps, stepIcs, upsertNote } from "../services/steps";

const qs = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function stepRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireUser);
  r.get("/", h(async (req, res) => res.json(await listSteps(ctx, req.user!.id, qs(req.query.status)))));
  r.post("/", h(async (req, res) => res.status(201).json(await createStep(ctx, req.user!.id, req.body))));
  r.get("/suggestions", h(async (req, res) => res.json(await getSuggestions(ctx, req.user!.id, { deedId: qs(req.query.deedId), trialId: qs(req.query.trialId) }))));
  r.post("/:id/confirm", h(async (req, res) => res.json(await confirmStep(ctx, req.user!.id, String(req.params.id)))));
  r.post("/:id/drop", h(async (req, res) => res.json(await dropStep(ctx, req.user!.id, String(req.params.id)))));
  r.post("/:id/complete", h(async (req, res) => res.json(await completeSelfStep(ctx, req.user!.id, String(req.params.id), req.body))));
  r.put("/:id/notes/:kind", h(async (req, res) => res.json(await upsertNote(ctx, req.user!.id, String(req.params.id), String(req.params.kind), req.body))));
  r.get(
    "/:id/ics",
    h(async (req, res) => {
      const ics = await stepIcs(ctx, req.user!.id, String(req.params.id));
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="first-step.ics"`);
      res.send(ics);
    }),
  );
  return r;
}

export function deedRoutes(ctx: AppContext) {
  const r = Router();
  r.get("/:id", h(async (req, res) => res.json(await getDeedView(ctx, String(req.params.id), req.user?.id))));
  r.patch(
    "/:id",
    requireUser,
    h(async (req, res) => res.json(await setDeedVisibility(ctx, req.user!.id, String(req.params.id), deedVisibilityInput.parse(req.body).visibility))),
  );
  return r;
}

export function notificationRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireUser);
  r.get("/", h(async (req, res) => res.json(await listNotifications(ctx, req.user!.id))));
  r.post(
    "/read-all",
    h(async (req, res) => {
      await readAllNotifications(ctx, req.user!.id);
      res.status(204).end();
    }),
  );
  return r;
}
