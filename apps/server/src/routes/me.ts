import { Router } from "express";
import { destroySession, requireUser } from "../auth/session";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { addWant, getMe, saveCharacter, updateWant } from "../services/characters";
import { deleteUser } from "../services/users";

export function meRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireUser);
  r.get("/", h(async (req, res) => res.json(await getMe(ctx, req.user!))));
  r.delete(
    "/",
    h(async (req, res) => {
      await destroySession(ctx, req, res);
      await deleteUser(ctx, req.user!.id);
      res.status(204).end();
    }),
  );
  r.put(
    "/character",
    h(async (req, res) => {
      await saveCharacter(ctx, req.user!.id, req.body);
      res.json(await getMe(ctx, req.user!));
    }),
  );
  r.post("/wants", h(async (req, res) => res.status(201).json(await addWant(ctx, req.user!.id, req.body))));
  r.patch("/wants/:id", h(async (req, res) => res.json(await updateWant(ctx, req.user!.id, String(req.params.id), req.body))));
  return r;
}
