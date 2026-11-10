import { oauthClients, oauthGrants, oauthTokens } from "@lj/db";
import { and, eq, isNull } from "drizzle-orm";
import type { AppContext } from "../context";
import { notFound } from "../http/errors";

export interface ConnectionView {
  clientId: string;
  name: string;
  connectedAt: Date;
  lastUsedAt: Date | null;
}

/** Active AI clients for this person: one row per client, oldest grant as the connect time. */
export async function listConnections(ctx: AppContext, userId: string): Promise<ConnectionView[]> {
  const grants = await ctx.db
    .select({
      clientId: oauthGrants.clientId,
      createdAt: oauthGrants.createdAt,
      lastUsedAt: oauthGrants.lastUsedAt,
      info: oauthClients.info,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthGrants.clientId))
    .where(and(eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)));

  const byClient = new Map<string, ConnectionView>();
  for (const g of grants) {
    const info = (g.info ?? {}) as { client_name?: string };
    const name = info.client_name?.trim() || "AI 用戶端";
    const cur = byClient.get(g.clientId);
    if (!cur) {
      byClient.set(g.clientId, { clientId: g.clientId, name, connectedAt: g.createdAt, lastUsedAt: g.lastUsedAt });
      continue;
    }
    if (g.createdAt < cur.connectedAt) cur.connectedAt = g.createdAt;
    if (g.lastUsedAt && (!cur.lastUsedAt || g.lastUsedAt > cur.lastUsedAt)) cur.lastUsedAt = g.lastUsedAt;
  }
  return [...byClient.values()].sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0) || b.connectedAt.getTime() - a.connectedAt.getTime());
}

/** Revoke every grant and token for this user and client. Later refresh cannot mint a new access token. */
export async function disconnectClient(ctx: AppContext, userId: string, clientId: string) {
  const now = ctx.now();
  const n = await ctx.db.transaction(async (tx) => {
    const grants = await tx
      .select({ id: oauthGrants.id })
      .from(oauthGrants)
      .where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.clientId, clientId), isNull(oauthGrants.revokedAt)))
      .for("update");
    if (!grants.length) return 0;
    await tx.update(oauthGrants).set({ revokedAt: now }).where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.clientId, clientId), isNull(oauthGrants.revokedAt)));
    await tx.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.clientId, clientId), isNull(oauthTokens.revokedAt)));
    return grants.length;
  });
  if (!n) throw notFound("connection");
}
