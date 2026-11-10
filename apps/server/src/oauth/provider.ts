import { newId, oauthClients, oauthCodes, oauthGrants, oauthRequests, oauthTokens, randomToken, schema, sha256, type Db } from "@lj/db";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { and, eq, gt, isNull, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { Response } from "express";
import type { AppContext } from "../context";

export const SCOPE = "world";
const ACCESS_TTL_SEC = 3600;
const REFRESH_TTL_SEC = 30 * 86400;
const CODE_TTL_SEC = 300;
const REQUEST_TTL_SEC = 900;

export function mcpResourceUrl(ctx: AppContext) {
  return `${ctx.config.baseUrl}/mcp`;
}

const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");

type GrantWriter = Db | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export class LongjiaoOAuthProvider implements OAuthServerProvider {
  constructor(private ctx: AppContext) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    const db = this.ctx.db;
    return {
      async getClient(clientId) {
        const [c] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
        return c ? (c.info as OAuthClientInformationFull) : undefined;
      },
      async registerClient(info) {
        const full = info as OAuthClientInformationFull;
        await db.insert(oauthClients).values({ clientId: full.client_id, info: full });
        return full;
      },
    };
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const resource = params.resource ? params.resource.toString() : mcpResourceUrl(this.ctx);
    if (norm(resource) !== norm(mcpResourceUrl(this.ctx))) {
      const u = new URL(params.redirectUri);
      u.searchParams.set("error", "invalid_target");
      if (params.state) u.searchParams.set("state", params.state);
      res.redirect(302, u.toString());
      return;
    }
    const id = newId("oar");
    await this.ctx.db.insert(oauthRequests).values({
      id,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state ?? null,
      scopes: params.scopes?.length ? params.scopes : [SCOPE],
      resource,
      expiresAt: new Date(this.ctx.now().getTime() + REQUEST_TTL_SEC * 1000),
    });
    res.redirect(302, `/oauth/consent?req=${id}`);
  }

  /** Called by the consent page once the person approves. Returns the client redirect URL. */
  async approve(requestId: string, userId: string): Promise<string> {
    const req = await this.pendingRequest(requestId);
    const code = randomToken();
    await this.ctx.db.insert(oauthCodes).values({
      code: sha256(code),
      clientId: req.clientId,
      userId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      scopes: req.scopes,
      resource: req.resource,
      expiresAt: new Date(this.ctx.now().getTime() + CODE_TTL_SEC * 1000),
    });
    await this.ctx.db.delete(oauthRequests).where(eq(oauthRequests.id, req.id));
    const u = new URL(req.redirectUri);
    u.searchParams.set("code", code);
    if (req.state) u.searchParams.set("state", req.state);
    return u.toString();
  }

  async deny(requestId: string): Promise<string> {
    const req = await this.pendingRequest(requestId);
    await this.ctx.db.delete(oauthRequests).where(eq(oauthRequests.id, req.id));
    const u = new URL(req.redirectUri);
    u.searchParams.set("error", "access_denied");
    if (req.state) u.searchParams.set("state", req.state);
    return u.toString();
  }

  async pendingRequest(requestId: string) {
    const [req] = await this.ctx.db.select().from(oauthRequests).where(and(eq(oauthRequests.id, requestId), gt(oauthRequests.expiresAt, this.ctx.now())));
    if (!req) throw new InvalidGrantError("authorization request expired");
    return req;
  }

  private async findCode(client: OAuthClientInformationFull, code: string) {
    const [row] = await this.ctx.db.select().from(oauthCodes).where(eq(oauthCodes.code, sha256(code)));
    if (!row || row.clientId !== client.client_id || row.usedAt || row.expiresAt <= this.ctx.now()) throw new InvalidGrantError("invalid authorization code");
    return row;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    return (await this.findCode(client, authorizationCode)).codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string, _verifier?: string, redirectUri?: string): Promise<OAuthTokens> {
    const row = await this.findCode(client, authorizationCode);
    if (redirectUri && redirectUri !== row.redirectUri) throw new InvalidGrantError("redirect_uri mismatch");
    const used = await this.ctx.db.update(oauthCodes).set({ usedAt: this.ctx.now() }).where(and(eq(oauthCodes.code, row.code), isNull(oauthCodes.usedAt))).returning();
    if (!used.length) throw new InvalidGrantError("authorization code already used");
    return this.issue(client.client_id, row.userId, row.scopes, row.resource);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const hash = sha256(refreshToken);
    return this.ctx.db.transaction(async (tx) => {
      const [peek] = await tx.select().from(oauthTokens).where(and(eq(oauthTokens.token, hash), eq(oauthTokens.kind, "refresh")));
      if (!peek?.grantId || peek.clientId !== client.client_id) throw new InvalidGrantError("invalid refresh token");
      // Lock the grant before the token so disconnect (same order) cannot deadlock.
      const [grant] = await tx.select().from(oauthGrants).where(eq(oauthGrants.id, peek.grantId)).for("update");
      if (!grant || grant.revokedAt || grant.userId !== peek.userId || grant.clientId !== peek.clientId) throw new InvalidGrantError("invalid refresh token");
      const [row] = await tx.select().from(oauthTokens).where(eq(oauthTokens.token, hash)).for("update");
      if (!row || row.revokedAt || row.expiresAt <= this.ctx.now() || row.grantId !== grant.id) throw new InvalidGrantError("invalid refresh token");
      const revoked = await tx.update(oauthTokens).set({ revokedAt: this.ctx.now() }).where(and(eq(oauthTokens.token, row.token), isNull(oauthTokens.revokedAt))).returning();
      if (!revoked.length) throw new InvalidGrantError("refresh token already used");
      return this.issue(client.client_id, row.userId, row.scopes, row.resource, row.grantId, tx);
    });
  }

  private async issue(clientId: string, userId: string, scopes: string[], resource: string | null, grantId?: string, db: GrantWriter = this.ctx.db): Promise<OAuthTokens> {
    const access = randomToken();
    const refresh = randomToken();
    const now = this.ctx.now();
    const gid = grantId ?? newId("grt");
    if (!grantId) await db.insert(oauthGrants).values({ id: gid, clientId, userId, createdAt: now });
    await db.insert(oauthTokens).values([
      { token: sha256(access), kind: "access", clientId, userId, scopes, resource, grantId: gid, expiresAt: new Date(now.getTime() + ACCESS_TTL_SEC * 1000) },
      { token: sha256(refresh), kind: "refresh", clientId, userId, scopes, resource, grantId: gid, expiresAt: new Date(now.getTime() + REFRESH_TTL_SEC * 1000) },
    ]);
    return { access_token: access, token_type: "bearer", expires_in: ACCESS_TTL_SEC, refresh_token: refresh, scope: scopes.join(" ") };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const [row] = await this.ctx.db.select().from(oauthTokens).where(and(eq(oauthTokens.token, sha256(token)), eq(oauthTokens.kind, "access")));
    if (!row || row.revokedAt || row.expiresAt <= this.ctx.now()) throw new InvalidTokenError("invalid or expired token");
    if (row.grantId) {
      const touched = await this.ctx.db
        .update(oauthGrants)
        .set({ lastUsedAt: this.ctx.now() })
        .where(and(eq(oauthGrants.id, row.grantId), isNull(oauthGrants.revokedAt)))
        .returning({ id: oauthGrants.id });
      if (!touched.length) throw new InvalidTokenError("invalid or expired token");
      const [still] = await this.ctx.db.select({ token: oauthTokens.token }).from(oauthTokens).where(and(eq(oauthTokens.token, row.token), isNull(oauthTokens.revokedAt)));
      if (!still) throw new InvalidTokenError("invalid or expired token");
    }
    return {
      token,
      clientId: row.clientId,
      scopes: row.scopes,
      expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { userId: row.userId },
    };
  }

  /** Revokes the whole grant: this token and every access or refresh token minted from the same authorization. */
  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const hash = sha256(request.token);
    const now = this.ctx.now();
    await this.ctx.db.transaction(async (tx) => {
      const [peek] = await tx.select().from(oauthTokens).where(eq(oauthTokens.token, hash));
      if (!peek || peek.clientId !== client.client_id) return;
      if (!peek.grantId) {
        await tx.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.token, hash), isNull(oauthTokens.revokedAt)));
        return;
      }
      await tx.select().from(oauthGrants).where(eq(oauthGrants.id, peek.grantId)).for("update");
      await tx.update(oauthGrants).set({ revokedAt: now }).where(and(eq(oauthGrants.id, peek.grantId), isNull(oauthGrants.revokedAt)));
      await tx.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.grantId, peek.grantId), isNull(oauthTokens.revokedAt)));
    });
  }
}
