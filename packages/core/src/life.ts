import { z } from "zod";

export const LIFE_ACTIVITIES = [
  { id: "shop", name: "逛逛小店", emoji: "🧣", place: "萬事屋", wish: "想換個新樣子。", help: "幫我挑一條軟軟的圍巾？", story: "萬事屋老闆翻出一條雲朵圍巾。小龍試戴了三次，還是把頭鑽錯洞。", reward: "雲朵圍巾", category: "衣服" },
  { id: "exercise", name: "河邊動一動", emoji: "🍃", place: "河邊草地", wish: "腳趾想伸懶腰。", help: "陪我去河邊跑一小圈？", story: "鎮民阿湧教小龍吹葉子哨。小龍吹出噗的一聲，兩個一起笑倒。", reward: "葉子哨", category: "旅行紀念品" },
  { id: "music", name: "聽一首小曲", emoji: "🔔", place: "音樂坊", wish: "耳朵想聽點新聲音。", help: "幫我打三下拍子？", story: "鎮民阿芽敲了三下鈴。小龍慢了一拍，卻剛好接住最後一個音。", reward: "小鈴鐺", category: "旅行紀念品" },
  { id: "visit", name: "去朋友家喝茶", emoji: "🍵", place: "小栗的家", wish: "想找個伴坐一下。", help: "陪我帶點小餅乾？", story: "鎮民小栗端出兩杯茶。小龍把餅乾疊成塔，小栗偷偷在旁邊加了一層。", reward: "茶會合照", category: "朋友相簿" },
  { id: "festival", name: "廣場湊熱鬧", emoji: "🏮", place: "四季廣場", wish: "廣場好像有熱鬧。", help: "幫我扶住小燈的另一邊？", story: "鎮民們在廣場掛小燈。小龍負責扶梯子，最後自己也掛上了一顆。", reward: "四季小燈", category: "房間佈置" },
  { id: "town", name: "去霧丘鎮旅行", emoji: "🚞", place: "霧丘鎮", wish: "想看看山後面。", help: "幫我把小包包扣好？", story: "霧丘鎮車掌替小龍指路。牠還是繞回原點，卻多認識了一家熱湯店。", reward: "霧丘車票夾", category: "旅行紀念品" },
  { id: "abroad", name: "去星砂島出國玩", emoji: "🐚", place: "星砂島", wish: "想學海那邊的招呼。", help: "陪我練一次招手？", story: "星砂島向導帶小龍聽海。牠學會島上的招呼，把一小瓶星砂帶回家。", reward: "星砂瓶", category: "旅行紀念品" },
] as const;
export type LifeActivityId = typeof LIFE_ACTIVITIES[number]["id"];
export const lifeActivityId = z.enum(["shop", "exercise", "music", "visit", "festival", "town", "abroad"]);
export const lifeActivityInput = z.object({ activityId: lifeActivityId });
export const lifePatchInput = z.object({
  allowVisits: z.boolean().optional(),
  outfit: z.literal("shop").nullable().optional(),
  decoration: z.literal("festival").nullable().optional(),
});
const FESTIVAL_STORIES = {
  春: "鎮民們把花瓣掛成彩帶。小龍接住一片，貼在小栗的帽子上。",
  夏: "廣場的夏夜亮起小燈。小龍捧著冰西瓜，和鎮民一起看星星。",
  秋: "鎮民們用落葉佈置廣場。小龍撿起最大的一片，當成小栗的扇子。",
  冬: "廣場飄著熱茶香。小龍和鎮民掛小燈，手套不小心連在一起。",
} as const;
export function lifeActivityStory(id: LifeActivityId, now: Date): string {
  return id === "festival" ? FESTIVAL_STORIES[lifeClock(now).season] : LIFE_ACTIVITIES.find(a => a.id === id)!.story;
}
const entry = z.object({ activityId: lifeActivityId, at: z.string() });
// New play is capped in the server. Reading must not discard a whole record
// because one entry is unknown or an older save is longer than today's cap.
export const lifeStateSchema = z.object({
  version: z.literal(1).default(1),
  days: z.array(z.object({ day: z.string(), autonomous: z.string(), entries: z.array(entry) })).default([]),
  inventory: z.array(z.object({ activityId: lifeActivityId, earnedOn: z.string() })).default([]),
  outfit: z.literal("shop").nullable().default(null),
  decoration: z.literal("festival").nullable().default(null),
  allowVisits: z.boolean().default(false),
});
export type LifeState = z.infer<typeof lifeStateSchema>;
export type LifeIssue = { path: string; reason: string };
export type LifeRecord = {
  state: LifeState;
  /** Original `sharing.life` object, when there was one. */
  raw: Record<string, unknown> | null;
  /** False when saving the migrated state would replace data we could not carry forward. */
  canWrite: boolean;
  issues: LifeIssue[];
  opaque: { outfit: boolean; decoration: boolean; allowVisits: boolean };
};
const KNOWN_ACTIVITIES = new Set<string>(LIFE_ACTIVITIES.map(activity => activity.id));
const emptyOpaque = { outfit: false, decoration: false, allowVisits: false };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function emptyLife(): LifeState {
  return lifeStateSchema.parse({});
}
function isKnownEntry(value: unknown): value is { activityId: LifeActivityId; at: string } {
  return isPlainObject(value) && typeof value.activityId === "string" && KNOWN_ACTIVITIES.has(value.activityId) && typeof value.at === "string" && value.at.length > 0;
}
function isKnownInventory(value: unknown): value is { activityId: LifeActivityId; earnedOn: string } {
  return isPlainObject(value) && typeof value.activityId === "string" && KNOWN_ACTIVITIES.has(value.activityId) && typeof value.earnedOn === "string";
}
function isMergeableDay(value: unknown): value is Record<string, unknown> & { day: string; entries: unknown[] } {
  return isPlainObject(value) && typeof value.day === "string" && value.day.length > 0 && Array.isArray(value.entries);
}

/** Reads what it can. Missing life is an empty record. A broken document is not writable. */
export function migrateLife(sharing: unknown): LifeRecord {
  if (!isPlainObject(sharing) || !Object.prototype.hasOwnProperty.call(sharing, "life")) {
    return { state: emptyLife(), raw: null, canWrite: true, issues: [], opaque: { ...emptyOpaque } };
  }
  const raw = sharing.life;
  if (!isPlainObject(raw)) {
    return { state: emptyLife(), raw: null, canWrite: false, issues: [{ path: "life", reason: "life record is not an object" }], opaque: { ...emptyOpaque } };
  }
  const issues: LifeIssue[] = [];
  const versionBlocked = "version" in raw && raw.version !== 1;
  if (versionBlocked) issues.push({ path: "life.version", reason: "unknown life version" });
  const days = salvageDays(raw.days, issues);
  const inventory = salvageInventory(raw.inventory, issues);
  const outfit = salvageLiteral(raw, "outfit", "shop", issues);
  const decoration = salvageLiteral(raw, "decoration", "festival", issues);
  const allowVisits = salvageBoolean(raw, issues);
  return {
    state: lifeStateSchema.parse({ version: 1, days: days.known, inventory: inventory.known, outfit: outfit.value, decoration: decoration.value, allowVisits: allowVisits.value }),
    raw, canWrite: !versionBlocked && !days.fatal && !inventory.fatal, issues,
    opaque: { outfit: outfit.opaque, decoration: decoration.opaque, allowVisits: allowVisits.opaque },
  };
}
export const readLife = (sharing: unknown): LifeState => migrateLife(sharing).state;

function salvageDays(value: unknown, issues: LifeIssue[]) {
  if (value === undefined) return { known: [] as LifeState["days"], fatal: false };
  if (!Array.isArray(value)) {
    issues.push({ path: "life.days", reason: "not an array" });
    return { known: [] as LifeState["days"], fatal: true };
  }
  const known: LifeState["days"] = [];
  value.forEach((item, index) => {
    if (!isMergeableDay(item)) {
      issues.push({ path: `life.days[${index}]`, reason: "day was left untouched" });
      return;
    }
    const entries: LifeState["days"][number]["entries"] = [];
    item.entries.forEach((entry, entryIndex) => {
      if (!isKnownEntry(entry)) {
        issues.push({ path: `life.days[${index}].entries[${entryIndex}]`, reason: "unrecognized entry left in place" });
        return;
      }
      entries.push({ activityId: entry.activityId, at: entry.at });
    });
    if (typeof item.autonomous !== "string") issues.push({ path: `life.days[${index}].autonomous`, reason: "unreadable note left in place" });
    known.push({ day: item.day, autonomous: typeof item.autonomous === "string" ? item.autonomous : "", entries });
  });
  return { known, fatal: false };
}
function salvageInventory(value: unknown, issues: LifeIssue[]) {
  if (value === undefined) return { known: [] as LifeState["inventory"], fatal: false };
  if (!Array.isArray(value)) {
    issues.push({ path: "life.inventory", reason: "not an array" });
    return { known: [] as LifeState["inventory"], fatal: true };
  }
  const known: LifeState["inventory"] = [];
  value.forEach((item, index) => {
    if (!isKnownInventory(item)) {
      issues.push({ path: `life.inventory[${index}]`, reason: "unrecognized keepsake left in place" });
      return;
    }
    known.push({ activityId: item.activityId, earnedOn: item.earnedOn });
  });
  return { known, fatal: false };
}
function salvageLiteral<T extends string>(raw: Record<string, unknown>, key: "outfit" | "decoration", allowed: T, issues: LifeIssue[]) {
  if (!(key in raw) || raw[key] === null) return { value: null as T | null, opaque: false };
  if (raw[key] === allowed) return { value: allowed, opaque: false };
  issues.push({ path: `life.${key}`, reason: "unrecognized value left in place" });
  return { value: null as T | null, opaque: true };
}
function salvageBoolean(raw: Record<string, unknown>, issues: LifeIssue[]) {
  if (!("allowVisits" in raw)) return { value: false, opaque: false };
  if (typeof raw.allowVisits === "boolean") return { value: raw.allowVisits, opaque: false };
  issues.push({ path: "life.allowVisits", reason: "unreadable value left in place" });
  return { value: false, opaque: true };
}

/** Writes the played state back without dropping entries the migration could not interpret. */
export function commitLife(record: LifeRecord, before: LifeState, after: LifeState): Record<string, unknown> {
  const raw = record.raw ?? {};
  return {
    ...(record.raw ? { ...record.raw } : {}),
    version: 1,
    days: mergeDays(raw.days, after.days),
    inventory: mergeInventory(raw.inventory, after.inventory),
    outfit: pickStored(record.opaque.outfit, raw.outfit, before.outfit, after.outfit),
    decoration: pickStored(record.opaque.decoration, raw.decoration, before.decoration, after.decoration),
    allowVisits: pickStored(record.opaque.allowVisits, raw.allowVisits, before.allowVisits, after.allowVisits),
  };
}
function pickStored<T>(opaque: boolean, rawValue: unknown, before: T, after: T): unknown {
  if (after !== before) return after;
  return opaque ? rawValue : after;
}
function mergeDays(rawDays: unknown, stateDays: LifeState["days"]): unknown[] {
  const rawList = Array.isArray(rawDays) ? rawDays : [];
  const used = new Set<number>();
  const merged = stateDays.map(day => {
    const index = rawList.findIndex((item, itemIndex) => !used.has(itemIndex) && isMergeableDay(item) && item.day === day.day);
    if (index < 0) return { day: day.day, autonomous: day.autonomous, entries: day.entries };
    used.add(index);
    const rawDay = rawList[index] as Record<string, unknown> & { entries: unknown[] };
    const pending = day.entries.map(item => ({ activityId: item.activityId, at: item.at }));
    const entries: unknown[] = [];
    for (const entry of rawDay.entries) {
      if (!isKnownEntry(entry)) {
        entries.push(entry);
        continue;
      }
      const next = pending.shift();
      entries.push(next ? { ...entry, ...next } : entry);
    }
    entries.push(...pending);
    const stored: Record<string, unknown> = { ...rawDay, day: day.day, entries };
    if (typeof rawDay.autonomous === "string") stored.autonomous = day.autonomous;
    return stored;
  });
  rawList.forEach((item, index) => {
    if (!used.has(index) && !isMergeableDay(item)) merged.push(item);
  });
  return merged;
}
function mergeInventory(rawInventory: unknown, stateItems: LifeState["inventory"]): unknown[] {
  const rawList = Array.isArray(rawInventory) ? rawInventory : [];
  const pending = stateItems.map(item => ({ activityId: item.activityId, earnedOn: item.earnedOn }));
  const merged: unknown[] = [];
  for (const item of rawList) {
    if (!isKnownInventory(item)) {
      merged.push(item);
      continue;
    }
    const next = pending.shift();
    merged.push(next ? { ...item, ...next } : item);
  }
  merged.push(...pending);
  return merged;
}
export function lifePick(seed: string, length: number) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) % length;
}
export function lifeClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  const hour = Number(value("hour")), month = Number(value("month"));
  const season: "春" | "夏" | "秋" | "冬" = month >= 3 && month <= 5 ? "春" : month >= 6 && month <= 8 ? "夏" : month >= 9 && month <= 11 ? "秋" : "冬";
  const period: "早晨" | "午後" | "傍晚" | "夜裡" = hour >= 5 && hour < 11 ? "早晨" : hour >= 11 && hour < 17 ? "午後" : hour >= 17 && hour < 21 ? "傍晚" : "夜裡";
  return { day: `${value("year")}-${value("month")}-${value("day")}`, season, period };
}
const SEASON_LINES = { 春: "花瓣黏在鼻尖上。", 夏: "鎮民分了一片冰西瓜。", 秋: "落葉在腳邊打了個轉。", 冬: "大家把手揣進暖暖的口袋。" };
const PERIOD_LINES = { 早晨: "早餐店剛升起第一縷香氣。", 午後: "屋簷下有個圓圓的影子。", 傍晚: "街燈一盞接一盞亮了。", 夜裡: "月亮陪小龍走了最後一小段。" };
export function lifeScene(now: Date) {
  const c = lifeClock(now);
  return `${c.season}天的${c.period}，${SEASON_LINES[c.season]}${PERIOD_LINES[c.period]}`;
}
export function autonomousLife(seed: string, day: string) {
  const lines = ["早些時候，小龍幫麵包熊翻了招牌。翻反了，兩個笑了好久。", "早些時候，小龍去河邊學跳石頭。鎮民阿湧借牠一條乾毛巾。", "早些時候，小龍在音樂坊聽了一首歌。牠一路哼到家門口。", "早些時候，小龍和小栗找雲朵。兩個都說那朵像烤番薯。"];
  return lines[lifePick(`${seed}:${day}`, lines.length)]!;
}
type LifeDayView = Omit<LifeState["days"][number], "entries"> & { entries: Array<LifeState["days"][number]["entries"][number] & { story: string }> };
export interface LifeView {
  day: string;
  season: string;
  period: string;
  today: LifeDayView;
  history: LifeDayView[];
  inventory: LifeState["inventory"];
  outfit: LifeState["outfit"];
  decoration: LifeState["decoration"];
  allowVisits: boolean;
  mood: string;
  wish: string;
  help: string;
  scene: string;
  recommendedId: LifeActivityId;
  activities: Array<Omit<typeof LIFE_ACTIVITIES[number], "story"> & { story: string; done: boolean }>;
  encounter?: { name: string; appearance: unknown } | null;
  inspiration?: { placeId: string; title: string; who: string } | null;
}
