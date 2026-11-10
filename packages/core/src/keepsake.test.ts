import { describe, expect, it } from "vitest";
import {
  BABY_LINES,
  GROWTH_AT,
  TOWN_FOLK,
  bannedHits,
  dedupeKeepsakes,
  growthLine,
  growthStage,
  keepsakeFor,
  nextGrowthAt,
  starLine,
  warmLine,
} from "./keepsake";

const chrome = [
  ...BABY_LINES,
  ...Object.values(TOWN_FOLK).flatMap((f) => [f.name, f.line]),
  starLine(1),
  starLine(4),
  starLine(15),
  growthLine(1),
  growthLine(2),
  growthLine(3),
  "出門逛逛",
  "我也去摸摸看",
  "我做到了！",
  "收進櫃裡",
  "收下星星",
  "信物收藏",
  "收藏櫃",
  "小背包背好了。",
  "有一顆蛋在龍角鎮門口滾來滾去。好像在等你。",
  "把牠撿回家",
  "登入後就能把寶寶帶回家。",
  "頭上要長什麼？角？葉子？還是一頂貝雷帽？",
  "嗨！我是小龍。",
  "寫你要做的就好，我幫你記著。",
  "我幫你記著喔。",
  "先收進抽屜",
  "小龍把它塞進抽屜了。",
  "當時的表情是？",
  "小背包",
  "我想交一個會說話的朋友，幫我去打聽消息。你有認識的嗎？",
  "你開課、帶跑、辦讀書會嗎？來鎮上開一間小店吧。",
];

describe("keepsakes", () => {
  it("grows at 3, 7 and 15 stars, and the talking friend waits until stage 2", () => {
    expect(GROWTH_AT).toEqual([3, 7, 15]);
    expect(growthStage(0)).toBe(0);
    expect(growthStage(2)).toBe(0);
    expect(growthStage(3)).toBe(1);
    expect(growthStage(6)).toBe(1);
    expect(growthStage(7)).toBe(2);
    expect(growthStage(15)).toBe(3);
    expect(nextGrowthAt(4)).toBe(7);
    expect(nextGrowthAt(15)).toBeNull();
  });

  it("names a real object and says who did what, without a postcard", () => {
    expect(keepsakeFor("music").name).toBe("吉他撥片");
    expect(keepsakeFor("outdoors").name).toBe("壓花");
    const line = warmLine({ name: "小雀 Mia", title: "去上一次聲樂課", districtKey: "music" });
    expect(line).toBe("小雀 Mia的吉他撥片。去上一次聲樂課。");
    expect(line).not.toContain("明信片");
    expect(bannedHits(line)).toEqual([]);
  });

  it("keeps novice chrome free of jargon, sermons and postcards", () => {
    expect(BABY_LINES.length).toBeGreaterThanOrEqual(10);
    for (const line of chrome) expect(bannedHits(line), line).toEqual([]);
    expect(starLine(4)).toContain("再 3 顆星");
    expect(growthLine(2)).toContain("圍巾");
  });

  it("shows one keepsake when the same person did the same thing twice", () => {
    const items = dedupeKeepsakes([
      { who: "小雀", title: "摸吉他" },
      { who: "小雀", title: "摸吉他" },
      { who: "阿杰", title: "摸吉他" },
    ]);
    expect(items).toEqual([{ who: "小雀", title: "摸吉他" }, { who: "阿杰", title: "摸吉他" }]);
  });
});
