import { createHash } from "node:crypto";
import { CONSENT_STYLE } from "../oauth/consent-style";

/** sha256 of the consent page's one static <style> block. Attribute styles are a separate directive. */
export const CONSENT_STYLE_HASH = `'sha256-${createHash("sha256").update(CONSENT_STYLE).digest("base64")}'`;

/**
 * Strict policy for the self-bundled app.
 * Scripts, fonts, API, and websockets stay on this origin.
 * The favicon is a data: SVG. React sets style attributes; the consent page's
 * stylesheet is allowed by hash instead of style-src 'unsafe-inline'.
 */
export function contentSecurityPolicyDirectives() {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    frameSrc: ["'none'"],
    formAction: ["'self'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", CONSENT_STYLE_HASH],
    styleSrcAttr: ["'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    workerSrc: ["'self'"],
  };
}
