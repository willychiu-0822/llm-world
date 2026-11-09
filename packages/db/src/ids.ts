import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyz";

/** Short, URL-safe, prefixed ids, e.g. `deed_k3j9...`. */
export function newId(prefix: string, length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}
