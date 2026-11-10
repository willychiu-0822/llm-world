const INTERNAL_ID = /\b(?:pq|stp|want|deed|chr|usr|trl|faq|ses|tev|bkg|fol|ntf|dsc|note|mod|prv|plc|oar|grt)_[0-9a-z]{6,}\b/gi;

/**
 * Text a player (or later, the town) will read.
 * Drops internal ids and speaks to the person as 你, never 主人.
 */
export function forPlayer(text: string): string {
  let s = text.replace(INTERNAL_ID, "");
  s = s.replace(/主人/g, "你");
  s = s.replace(/^你[，,：:]\s*/, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2");
  }
  s = s.replace(/\s+([，。！？、；：,.!?:])/g, "$1");
  s = s.replace(/（\s*）/g, "").replace(/\(\s*\)/g, "");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

/** Lowercase and keep only letters, digits and CJK characters. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function grams(text: string): Set<string> {
  const t = normalize(text);
  const out = new Set<string>();
  if (t.length === 1) out.add(t);
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Jaccard similarity over character bigrams; works for Chinese and English. */
export function textSimilarity(a: string, b: string): number {
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

export function bestMatch<T extends { text: string }>(query: string, items: T[], threshold = 0.3): T | undefined {
  let best: T | undefined;
  let bestScore = threshold;
  for (const item of items) {
    const s = textSimilarity(query, item.text);
    if (s >= bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}
