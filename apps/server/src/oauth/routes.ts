import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Router } from "express";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { getCharacter } from "../services/characters";
import { CONSENT_STYLE } from "./consent-style";
import { LongjiaoOAuthProvider, mcpResourceUrl, SCOPE } from "./provider";

function csrfFor(ctx: AppContext, requestId: string, userId: string) {
  return createHmac("sha256", ctx.config.sessionSecret)
    .update(`${requestId}:${userId}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function consentPage(o: {
  clientName: string;
  characterName: string | null;
  req: string;
  csrf: string;
}) {
  const who = o.characterName ? `「${esc(o.characterName)}」` : "還沒取名的寶寶";
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>連接 AI · 龍角鎮</title>
<style>${CONSENT_STYLE}</style></head><body><main class="card">
<h1>讓這個幫手進龍角鎮</h1>
<p><strong>${esc(o.clientName)}</strong> 想進龍角鎮，幫${who}去逛逛。</p>
<p>同意後，這個 AI 可以：</p>
<ul><li>讀取你的角色設定與想做的事</li><li>在鎮上探索真人的做過的事與試用機會</li><li>把發現帶回你的小信箱、向提供者發問</li><li>建議第一步（需要你在龍角鎮確認）、完成你交給它的 AI 步驟（結果要你看過才會公開）</li></ul>
<p>它看不到你的 Email、私人紀錄，也不能替你做出需要本人執行的承諾。</p>
<form method="post" action="/oauth/consent"><input type="hidden" name="req" value="${esc(o.req)}"><input type="hidden" name="csrf" value="${esc(o.csrf)}">
<div class="row"><button class="no" name="decision" value="deny">不要</button><button class="ok" name="decision" value="approve">同意連接</button></div></form>
</main></body></html>`;
}

export function oauthRoutes(ctx: AppContext) {
  const provider = new LongjiaoOAuthProvider(ctx);
  const r = Router();
  const rateLimit = ctx.config.env === "test" ? (false as const) : undefined;
  r.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(ctx.config.baseUrl),
      resourceServerUrl: new URL(mcpResourceUrl(ctx)),
      scopesSupported: [SCOPE],
      resourceName: "龍角鎮",
      clientRegistrationOptions: {
        clientSecretExpirySeconds: 0,
        ...(rateLimit === false ? { rateLimit } : {}),
      },
      authorizationOptions: rateLimit === false ? { rateLimit } : {},
      tokenOptions: rateLimit === false ? { rateLimit } : {},
    }),
  );

  r.get(
    "/oauth/consent",
    h(async (req, res) => {
      const reqId = String(req.query.req ?? "");
      if (!req.user) {
        res.redirect(302, `/login?next=${encodeURIComponent(`/oauth/consent?req=${reqId}`)}`);
        return;
      }
      const pending = await provider.pendingRequest(reqId).catch(() => null);
      if (!pending) {
        res.status(400).type("html").send("<p>這個連接請求已過期，請回到 AI 用戶端重新連接。</p>");
        return;
      }
      const client = (await provider.clientsStore.getClient(
        pending.clientId,
      )) as OAuthClientInformationFull;
      const character = await getCharacter(ctx, req.user.id);
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(
        consentPage({
          clientName: client.client_name ?? "AI 用戶端",
          characterName: character?.name ?? null,
          req: reqId,
          csrf: csrfFor(ctx, reqId, req.user.id),
        }),
      );
    }),
  );

  r.post(
    "/oauth/consent",
    h(async (req, res) => {
      if (!req.user) {
        res.status(401).send("login required");
        return;
      }
      const reqId = String(req.body?.req ?? "");
      if (!safeEqual(String(req.body?.csrf ?? ""), csrfFor(ctx, reqId, req.user.id))) {
        res.status(400).send("invalid request");
        return;
      }
      const url =
        req.body?.decision === "approve"
          ? await provider.approve(reqId, req.user.id)
          : await provider.deny(reqId);
      res.redirect(302, url);
    }),
  );

  return { router: r, provider };
}
