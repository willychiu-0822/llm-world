import { textSimilarity } from "./text";

export interface Candidate {
  kind: "deed" | "trial";
  id: string;
  districtKey: string;
  text: string;
  createdAt: Date;
  isDemo: boolean;
  ownerId?: string;
  /** Deed: this was the executor's first deed in this district. */
  isFirst?: boolean;
  /** Trial: length of the trial session. */
  durationMin?: number;
  exitAnytime?: boolean;
}

export interface CurationContext {
  wants: { text: string; districtKey: string }[];
  seenIds: Set<string>;
  selfUserId?: string;
  now: Date;
}

export type Reason = "same_district" | "similar_text" | "first_time" | "small_step" | "fresh" | "seen" | "demo";

export interface Ranked<C extends Candidate = Candidate> extends Candidate {
  score: number;
  reasons: Reason[];
  candidate: C;
}

const DAY = 86_400_000;

/**
 * Rule-based curation: related, similar, achievable ("first time"), one step away.
 * Never influenced by payment. Real content always ranks before demo content.
 */
export function rankCandidates<C extends Candidate>(candidates: C[], ctx: CurationContext, limit = 20): Ranked<C>[] {
  const ranked: Ranked<C>[] = [];
  for (const c of candidates) {
    if (ctx.selfUserId && c.ownerId === ctx.selfUserId) continue;
    const reasons: Reason[] = [];
    let score = 0;

    if (ctx.wants.length > 0) {
      const sameDistrict = ctx.wants.some((w) => w.districtKey === c.districtKey);
      const sim = Math.max(0, ...ctx.wants.map((w) => textSimilarity(w.text, c.text)));
      if (!sameDistrict && sim < 0.1) continue;
      if (sameDistrict) {
        score += 3;
        reasons.push("same_district");
      }
      if (sim >= 0.1) {
        score += sim * 3;
        reasons.push("similar_text");
      }
    }
    if (c.isFirst) {
      score += 2;
      reasons.push("first_time");
    }
    if (c.kind === "trial") {
      let small = 0;
      if (c.durationMin !== undefined && c.durationMin <= 90) small += 1;
      if (c.exitAnytime) small += 0.5;
      if (small > 0) {
        score += small;
        reasons.push("small_step");
      }
    }
    const ageDays = (ctx.now.getTime() - c.createdAt.getTime()) / DAY;
    const fresh = Math.max(0, 1 - ageDays / 30);
    if (fresh > 0) {
      score += fresh;
      reasons.push("fresh");
    }
    if (ctx.seenIds.has(c.id)) {
      score -= 2;
      reasons.push("seen");
    }
    if (c.isDemo) reasons.push("demo");
    ranked.push({ ...c, score, reasons, candidate: c });
  }
  ranked.sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || b.score - a.score);
  return ranked.slice(0, limit);
}
