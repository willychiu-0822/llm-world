import { z } from "zod";
import { DISTRICT_BY_KEY, type DistrictKey } from "./districts";

/** Stars needed to reach stage 1, 2 and 3. Stage 2 unlocks the talking-friend letter. */
export const GROWTH_AT = [3, 7, 15] as const;

export const STICKERS = ["😆", "🙂", "😮‍💨"] as const;
export type Sticker = (typeof STICKERS)[number];

export interface KeepsakeKind {
  key: string;
  name: string;
  emoji: string;
}

/** A small object that stands in for one real thing a townsperson did. */
export const KEEPSAKES: Record<DistrictKey, KeepsakeKind> = {
  music: { key: "pick", name: "吉他撥片", emoji: "🎸" },
  sports: { key: "ribbon", name: "完賽緞帶", emoji: "🎀" },
  crafts: { key: "clay", name: "小陶土", emoji: "🏺" },
  food: { key: "spoon", name: "木湯匙", emoji: "🥄" },
  learning: { key: "bookmark", name: "書籤", emoji: "🔖" },
  outdoors: { key: "flower", name: "壓花", emoji: "🌼" },
  social: { key: "cup", name: "小茶杯", emoji: "🍵" },
  volunteer: { key: "pouch", name: "小布包", emoji: "👝" },
  misc: { key: "pebble", name: "圓石子", emoji: "🪨" },
};

export function keepsakeFor(districtKey: string): KeepsakeKind {
  return (KEEPSAKES as Record<string, KeepsakeKind>)[districtKey] ?? KEEPSAKES.misc;
}

export interface TownFolk {
  name: string;
  line: string;
}

export const TOWN_FOLK: Record<DistrictKey, TownFolk> = {
  music: { name: "麻雀老師 Mia", line: "啦啦啦，今天的音階有點跑掉。" },
  sports: { name: "慢跑的阿杰", line: "慢慢跑，風會跟著來。" },
  crafts: { name: "捏捏", line: "歪了也是你做的，嘿嘿。" },
  food: { name: "麵包熊", line: "太鹹？那就再煮一鍋。" },
  learning: { name: "書蟲小葉", line: "這頁我折起來了。" },
  outdoors: { name: "山上的風", line: "山頂的橘子分你一顆。" },
  social: { name: "噗噗", line: "嘿，你也在等人說話嗎？" },
  volunteer: { name: "小幫手", line: "一個下午，三百個紙箱，咚。" },
  misc: { name: "萬事屋的旅人", line: "什麼都想試，口袋裝得下。" },
};

export function townFolk(districtKey: string): TownFolk {
  return (TOWN_FOLK as Record<string, TownFolk>)[districtKey] ?? TOWN_FOLK.misc;
}

export function placeLabel(districtKey: string, placeName?: string | null): string {
  if (placeName) return placeName;
  const d = (DISTRICT_BY_KEY as Record<string, { name: string } | undefined>)[districtKey];
  return d?.name ?? "鎮上";
}

/** Same person, same deed text, shown once. */
export function dedupeKeepsakes<T extends { who: string; title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = `${item.who}\n${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Who did what, in one short warm line. The object carries the feeling; the line just says the fact. */
export function warmLine(input: { name: string; title: string; districtKey: string }): string {
  const kind = keepsakeFor(input.districtKey);
  const who = input.name.trim() || "一位鎮民";
  const did = input.title.trim().replace(/[。！!]+$/g, "");
  return `${who}的${kind.name}。${did}。`;
}

export const BABY_LINES = [
  "嗨！這裡好大喔。",
  "我們出去晃晃？",
  "肚子咕嚕咕嚕。",
  "今天的風暖暖的。",
  "我聞到草地了。",
  "你回來啦！",
  "我的角歪了嗎？",
  "我想撿一片葉子。",
  "咚。我跳了一下。",
  "這個石頭圓圓的。",
  "晚點再出門也行。",
  "我把今天塞進口袋了。",
] as const;

export const STAGE_LABELS = ["小小隻", "會蹦蹦跳", "圍巾尺寸", "角長長了"] as const;

export function growthStage(stars: number): number {
  if (stars >= 15) return 3;
  if (stars >= 7) return 2;
  if (stars >= 3) return 1;
  return 0;
}

export function nextGrowthAt(stars: number): number | null {
  if (stars < 3) return 3;
  if (stars < 7) return 7;
  if (stars < 15) return 15;
  return null;
}

export function stageLabel(stage: number): string {
  return STAGE_LABELS[Math.max(0, Math.min(STAGE_LABELS.length - 1, stage))] ?? STAGE_LABELS[0];
}

export function starLine(stars: number): string {
  const next = nextGrowthAt(stars);
  if (next == null) return "★ +1！小龍原地轉了三圈。";
  return `★ +1！小龍原地轉了三圈。我們再 ${next - stars} 顆星就要長大了！`;
}

export function growthLine(stage: number): string {
  if (stage >= 3) return "小龍長大了！角長長了一點。";
  if (stage >= 2) return "小龍長大了！角變長了一點點，現在戴得下圍巾了。";
  if (stage >= 1) return "小龍長大了！跳得更高了。";
  return "";
}

/** Words that must not show on the novice path. */
export const NOVICE_BANNED = [
  "AI",
  "MCP",
  "token",
  "agent",
  "provider",
  "連接器",
  "用戶端",
  "伺服器",
  "事蹟",
  "主題區",
  "鏡子",
  "隨筆",
  "本人執行",
  "定義",
  "映照",
  "許可證",
  "可能的自己",
  "明信片",
  "越小越好",
  "不計分",
  "勇氣",
  "踏出",
  "第一步",
  "你應該",
  "試著",
  "記得",
  "反思",
] as const;

export function bannedHits(text: string): string[] {
  return NOVICE_BANNED.filter((word) => text.includes(word));
}

export const petPatchInput = z.object({
  notify: z.boolean().optional(),
  letterDismissed: z.boolean().optional(),
  mood: z.object({ deedId: z.string().min(1).max(64), sticker: z.enum(STICKERS) }).optional(),
});
