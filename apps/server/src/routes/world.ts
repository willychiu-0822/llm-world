import { Router } from "express";
import { requireRole, requireUser } from "../auth/session";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { getMetrics, listModeration, listProviders, purgeDemo, removeDeed, setProviderStatus } from "../services/admin";
import {
  addFaq,
  addSession,
  answerQuestion,
  applyProvider,
  attendBooking,
  createShop,
  createTrial,
  deleteFaq,
  getProviderDashboard,
  getSignals,
  listBookings,
  listQuestions,
  requireApprovedProvider,
  updateShop,
  updateTrial,
} from "../services/providers";
import { getPlace, getTown } from "../services/town";
import { getTrialView } from "../services/trials";

export function worldRoutes(ctx: AppContext) {
  const r = Router();
  r.get("/town", h(async (_req, res) => res.json(await getTown(ctx))));
  r.get("/places/:id", h(async (req, res) => res.json(await getPlace(ctx, String(req.params.id), req.user?.id))));
  r.get("/trials/:id", h(async (req, res) => res.json(await getTrialView(ctx, String(req.params.id)))));
  return r;
}

export function providerRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireUser);
  r.post("/apply", h(async (req, res) => res.status(201).json(await applyProvider(ctx, req.user!.id, req.body))));
  r.get("/me", h(async (req, res) => res.json(await getProviderDashboard(ctx, req.user!.id))));
  const p = (fn: (prov: Awaited<ReturnType<typeof requireApprovedProvider>>, req: Parameters<Parameters<typeof h>[0]>[0]) => Promise<unknown>, status = 200) =>
    h(async (req, res) => {
      const prov = await requireApprovedProvider(ctx, req.user!.id);
      const out = await fn(prov, req);
      if (out === undefined) res.status(204).end();
      else res.status(status).json(out);
    });
  r.post("/shops", p((prov, req) => createShop(ctx, prov, req.body), 201));
  r.patch("/shops/:id", p((prov, req) => updateShop(ctx, prov, String(req.params.id), req.body)));
  r.post("/trials", p((prov, req) => createTrial(ctx, prov, req.body), 201));
  r.patch("/trials/:id", p((prov, req) => updateTrial(ctx, prov, String(req.params.id), req.body)));
  r.post("/trials/:id/faqs", p((prov, req) => addFaq(ctx, prov, String(req.params.id), req.body), 201));
  r.delete("/faqs/:id", p((prov, req) => deleteFaq(ctx, prov, String(req.params.id))));
  r.post("/trials/:id/sessions", p((prov, req) => addSession(ctx, prov, String(req.params.id), req.body), 201));
  r.get("/sessions/:id/bookings", p((prov, req) => listBookings(ctx, prov, String(req.params.id))));
  r.post("/bookings/:id/attend", p((prov, req) => attendBooking(ctx, prov, String(req.params.id))));
  r.get("/questions", p((prov) => listQuestions(ctx, prov)));
  r.post("/questions/:id/answer", p((prov, req) => answerQuestion(ctx, prov, String(req.params.id), req.body)));
  r.get("/signals", p((prov) => getSignals(ctx, prov)));
  return r;
}

export function adminRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireRole("admin"));
  r.get("/providers", h(async (req, res) => res.json(await listProviders(ctx, typeof req.query.status === "string" ? req.query.status : undefined))));
  r.post("/providers/:id/approve", h(async (req, res) => res.json(await setProviderStatus(ctx, String(req.params.id), "approved"))));
  r.post("/providers/:id/suspend", h(async (req, res) => res.json(await setProviderStatus(ctx, String(req.params.id), "suspended"))));
  r.get("/moderation", h(async (_req, res) => res.json(await listModeration(ctx))));
  r.post("/deeds/:id/remove", h(async (req, res) => res.json(await removeDeed(ctx, String(req.params.id)))));
  r.get("/metrics", h(async (_req, res) => res.json(await getMetrics(ctx))));
  r.post("/demo/purge", h(async (_req, res) => res.json(await purgeDemo(ctx))));
  return r;
}
