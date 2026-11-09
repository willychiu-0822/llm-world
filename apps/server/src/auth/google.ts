import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "../config";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export interface GoogleClient {
  authUrl(state: string, redirectUri: string): string;
  /** Exchanges an authorization code for a verified profile. Replaceable in tests. */
  exchange(code: string, redirectUri: string): Promise<GoogleProfile>;
}

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function createGoogleClient(config: Config): GoogleClient {
  return {
    authUrl(state, redirectUri) {
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", config.google.clientId);
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", "openid email profile");
      u.searchParams.set("state", state);
      u.searchParams.set("prompt", "select_account");
      return u.toString();
    },
    async exchange(code, redirectUri) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
      const body = (await res.json()) as { id_token?: string };
      if (!body.id_token) throw new Error("google response has no id_token");
      const { payload } = await jwtVerify(body.id_token, JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.google.clientId,
      });
      if (!payload.email || payload.email_verified === false) throw new Error("google email not verified");
      return { sub: String(payload.sub), email: String(payload.email), name: String(payload.name ?? payload.email) };
    },
  };
}
