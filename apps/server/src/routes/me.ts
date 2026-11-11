import { Router } from "express";
import { destroySession, requireUser } from "../auth/session";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { addWant, getMe, saveCharacter, updateWant } from "../services/characters";
import { disconnectClient, listConnections } from "../services/connections";
import { listKeepsakes, patchPet, walkOut } from "../services/pet";
import { getLife, playLife, patchLife } from "../services/life";
import { deleteUser } from "../services/users";

export function meRoutes(ctx: AppContext) {
  const r = Router();
  r.use(requireUser);
  r.get("/", h(async (req, res) => res.json(await getMe(ctx, req.user!))));
  r.get("/connections", h(async (req, res) => res.json(await listConnections(ctx, req.user!.id))));
  r.post(
    "/connections/:clientId/disconnect",
    h(async (req, res) => {
      await disconnectClient(ctx, req.user!.id, String(req.params.clientId));
      res.status(204).end();
    }),
  );
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
  r.get("/life", h(async (req, res) => res.json(await getLife(ctx, req.user!.id))));
  r.post("/life/activities", h(async (req, res) => res.json(await playLife(ctx, req.user!.id, req.body))));
  r.patch("/life", h(async (req, res) => res.json(await patchLife(ctx, req.user!.id, req.body))));
  r.post("/walk", h(async (req, res) => res.json(await walkOut(ctx, req.user!.id))));
  r.get("/keepsakes", h(async (req, res) => res.json(await listKeepsakes(ctx, req.user!.id))));
  r.patch("/pet", h(async (req, res) => res.json(await patchPet(ctx, req.user!.id, req.body))));
  r.post("/wants", h(async (req, res) => res.status(201).json(await addWant(ctx, req.user!.id, req.body))));
  r.patch("/wants/:id", h(async (req, res) => res.json(await updateWant(ctx, req.user!.id, String(req.params.id), req.body))));
  return r;
}
