export type ModerationMode = "off" | "log" | "filter" | "block";

export interface Span {
  start: number;
  end: number;
}

export interface ProviderResult {
  flagged: boolean;
  categories: string[];
  spans: Span[];
}

export interface ModerationProvider {
  name: string;
  check(text: string, ctx?: Record<string, unknown>): Promise<ProviderResult>;
}

export interface ModerationResult {
  action: "allow" | "filter" | "block";
  flagged: boolean;
  categories: string[];
  text: string;
}

export interface Moderator {
  mode: ModerationMode;
  check(text: string, ctx?: Record<string, unknown>): Promise<ModerationResult>;
}

/** Keyword provider: case-insensitive substring match. */
export function keywordProvider(opts: { words: string[]; category?: string; name?: string }): ModerationProvider {
  const words = opts.words.map((w) => w.trim().toLowerCase()).filter(Boolean);
  const category = opts.category ?? "keyword";
  return {
    name: opts.name ?? "keyword",
    async check(text) {
      const lower = text.toLowerCase();
      const spans: Span[] = [];
      for (const w of words) {
        let i = lower.indexOf(w);
        while (i !== -1) {
          spans.push({ start: i, end: i + w.length });
          i = lower.indexOf(w, i + w.length);
        }
      }
      return { flagged: spans.length > 0, categories: spans.length ? [category] : [], spans };
    },
  };
}

function mask(text: string, spans: Span[]): string {
  const chars = Array.from(text.split(""));
  for (const s of spans) for (let i = s.start; i < s.end && i < chars.length; i++) chars[i] = "*";
  return chars.join("");
}

export function createModerator(opts: { mode: ModerationMode; providers: ModerationProvider[] }): Moderator {
  return {
    mode: opts.mode,
    async check(text, ctx) {
      if (opts.mode === "off" || !text) return { action: "allow", flagged: false, categories: [], text };
      const results = await Promise.all(opts.providers.map((p) => p.check(text, ctx)));
      const flagged = results.some((r) => r.flagged);
      const categories = [...new Set(results.flatMap((r) => r.categories))];
      if (!flagged) return { action: "allow", flagged: false, categories: [], text };
      if (opts.mode === "log") return { action: "allow", flagged: true, categories, text };
      if (opts.mode === "block") return { action: "block", flagged: true, categories, text };
      return { action: "filter", flagged: true, categories, text: mask(text, results.flatMap((r) => r.spans)) };
    },
  };
}

/** Small default list; extend through the MODERATION_WORDS env var or a file. */
export const DEFAULT_BLOCKLIST = ["幹你娘", "操你媽", "去死", "賤人", "fuck", "shit", "bitch"];
