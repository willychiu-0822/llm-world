import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Router } from "express";
import type { AppContext } from "../context";
import { h } from "../http/errors";
import { getCharacter } from "../services/characters";
import { LongjiaoOAuthProvider, mcpResourceUrl, SCOPE } from "./provider";

function csrfFor(ctx: AppContext, requestId: string, userId: string) {
  return createHmac("sha256", ctx.config.sessionSecret).update(`${requestId}:${userId}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function consentPage(o: { clientName: string; characterName: string | null; req: string; csrf: string }) {
  const who = o.characterName ? `你的角色「${esc(o.characterName)}」` : "你的角色（尚未設定，可以之後在龍角鎮設定）";
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>連接 AI · 龍角鎮</title>
<style>
:root{--paper:#FBF6EC;--ink:#4A3F35;--muted:#8A7B6C;--leaf:#7FA36B;--line:#E6DCC8}
@media (prefers-color-scheme: dark){:root{--paper:#2B2621;--ink:#F1E8DA;--muted:#BFB2A1;--leaf:#9CC388;--line:#4A4038}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;padding:16px}
.card{max-width:420px;width:100%;background:color-mix(in srgb,var(--paper) 92%,#fff);border:2px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 6px 0 var(--line)}
h1{font-size:1.4rem;margin:0 0 8px}p{line-height:1.7;margin:8px 0;color:var(--muted)}strong{color:var(--ink)}
ul{padding-left:1.2em;line-height:1.8}.row{display:flex;gap:12px;margin-top:20px}
button{flex:1;font:inherit;font-size:1rem;padding:12px;border-radius:999px;border:2px solid var(--ink);cursor:pointer}
.ok{background:var(--leaf);color:#fff;border-color:var(--leaf)}.no{background:transparent;color:var(--ink)}
</style></head><body><main class="card">
<h1>讓 AI 成為你的角色</h1>
<p><strong>${esc(o.clientName)}</strong> 想連接龍角鎮，成為${who}。</p>
<p>同意後，這個 AI 可以：</p>
<ul><li>讀取你的角色設定與想做的事</li><li>在鎮上探索真人的事蹟與試用機會</li><li>把發現帶回你的發現匣、向提供者發問</li><li>建議第一步（需要你在龍角鎮確認）、完成你交給它的 AI 步驟（結果要你看過才會公開）</li></ul>
<p>它看不到你的 Email、私人隨筆，也不能替你做出需要本人執行的承諾。</p>
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
      clientRegistrationOptions: { clientSecretExpirySeconds: 0, ...(rateLimit === false ? { rateLimit } : {}) },
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
      const client = (await provider.clientsStore.getClient(pending.clientId)) as OAuthClientInformationFull;
      const character = await getCharacter(ctx, req.user.id);
      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(consentPage({ clientName: client.client_name ?? "AI 用戶端", characterName: character?.name ?? null, req: reqId, csrf: csrfFor(ctx, reqId, req.user.id) }));
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
      const url = req.body?.decision === "approve" ? await provider.approve(reqId, req.user.id) : await provider.deny(reqId);
      res.redirect(302, url);
    }),
  );

  return { router: r, provider };
}
