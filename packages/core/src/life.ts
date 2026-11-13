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
export const lifeStateSchema = z.object({
  version: z.literal(1).default(1),
  days: z.array(z.object({ day: z.string(), autonomous: z.string(), entries: z.array(entry).max(7) })).max(60).default([]),
  inventory: z.array(z.object({ activityId: lifeActivityId, earnedOn: z.string() })).max(7).default([]),
  outfit: z.literal("shop").nullable().default(null),
  decoration: z.literal("festival").nullable().default(null),
  allowVisits: z.boolean().default(false),
});
export type LifeState = z.infer<typeof lifeStateSchema>;
export const readLife = (sharing: unknown): LifeState => {
  const raw = sharing && typeof sharing === "object" ? (sharing as Record<string, unknown>).life : undefined;
  const parsed = lifeStateSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : lifeStateSchema.parse({});
};
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
  /** 串門遇到的人：鎮民小栗，或同意串門的玩家小龍（只有名字與外觀，只在當下顯示）。 */
  encounter: { kind: "town"; name: string } | { kind: "player"; name: string; appearance: unknown };
  /** 鎮民的心意：別人公開分享、仍可見的一則經驗；沒有就是 null。 */
  inspiration: { placeId: string; placeName: string; title: string; who: string; isDemo: boolean } | null;
}
