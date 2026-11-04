import { characters, newId, providers, users } from "@lj/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "../context";
import { setProviderStatus } from "../services/admin";
import { saveCharacter, addWant } from "../services/characters";
import { addFaq, addSession, applyProvider, createShop, createTrial, getProviderByUser } from "../services/providers";
import { completeAiStep, completeSelfStep, createStep, upsertNote } from "../services/steps";

/**
 * Demo content: clearly labelled 示範, ranked after real content, never triggers thanks,
 * and removable with one click (admin → 清除示範內容).
 */

type Look = { body: "round" | "pear" | "tall"; accessory: string; main: string; accent: string; description: string };

interface DemoPerson {
  email: string;
  name: string;
  look: Look;
  personality: string;
  want: { text: string; districtKey: string };
  steps: { executor: "ai" | "self"; text: string; before?: string; after?: string; result?: string }[];
}

const PEOPLE: DemoPerson[] = [
  {
    email: "demo-mia@demo.longjiao",
    name: "小雀 Mia",
    look: { body: "round", accessory: "flower", main: "#F1DC8F", accent: "#E9AFB4", description: "頭上別著小花的上班族" },
    personality: "有點害羞，但很好奇",
    want: { text: "想在別人面前唱一首歌", districtKey: "music" },
    steps: [
      { executor: "ai", text: "請角色先問清楚聲樂試用課會做什麼", result: "老師說：前十分鐘練呼吸，接著唱音階，最後選一首熟悉的歌。不會要你一個人在大家面前唱。" },
      { executor: "self", text: "去上一次聲樂試用課", before: "怕破音、怕被笑，在門口站了五分鐘才進去。", after: "破音了一次，老師只說「很好，再來」，大家都笑了，但是是一起笑。" },
    ],
  },
  {
    email: "demo-run@demo.longjiao",
    name: "慢慢跑的阿杰",
    look: { body: "tall", accessory: "headphones", main: "#A9C7DE", accent: "#F2C6A8", description: "戴著耳機的工程師" },
    personality: "安靜、喜歡計畫",
    want: { text: "想試試看跑步", districtKey: "sports" },
    steps: [{ executor: "self", text: "參加一次新手 5K（走跑交替）", before: "我連 1 公里都沒跑過。", after: "走了一半的路，但教練一直陪著最後一個人，我沒有覺得丟臉。" }],
  },
  {
    email: "demo-craft@demo.longjiao",
    name: "捏捏",
    look: { body: "pear", accessory: "beret", main: "#D9C2A0", accent: "#B9CFA4", description: "戴貝雷帽的實習生" },
    personality: "慢熱、手很巧",
    want: { text: "想做一個自己的杯子", districtKey: "crafts" },
    steps: [{ executor: "self", text: "上一次陶藝體驗課", after: "杯子歪了，但那是我第一個做出來的東西，現在每天都用它喝水。" }],
  },
  {
    email: "demo-food@demo.longjiao",
    name: "麵包熊",
    look: { body: "round", accessory: "scarf", main: "#F2C6A8", accent: "#F1DC8F", description: "圍著圍巾的大學生" },
    personality: "喜歡吃，但從來不下廚",
    want: { text: "想做一道菜請朋友吃", districtKey: "food" },
    steps: [{ executor: "self", text: "照著影片煮一次番茄炒蛋給室友吃", before: "應該會失敗吧。", after: "有點太鹹，但室友吃光了。" }],
  },
  {
    email: "demo-learn@demo.longjiao",
    name: "書蟲小葉",
    look: { body: "tall", accessory: "glasses", main: "#B9CFA4", accent: "#CDB8DA", description: "戴圓眼鏡的老師" },
    personality: "愛看書，但很少跟人討論",
    want: { text: "想參加一次讀書會", districtKey: "learning" },
    steps: [
      { executor: "ai", text: "請角色找找有沒有新手友善的讀書會", result: "找到每月一次的社區讀書會，第一次參加可以只聽不發言。" },
      { executor: "self", text: "去社區讀書會只聽不發言", after: "最後還是忍不住說了一句，大家都點頭。" },
    ],
  },
  {
    email: "demo-out@demo.longjiao",
    name: "山上的風",
    look: { body: "pear", accessory: "leaf", main: "#B9CFA4", accent: "#A9C7DE", description: "頭上長著葉子的設計師" },
    personality: "喜歡安靜的地方",
    want: { text: "想一個人去爬一次郊山", districtKey: "outdoors" },
    steps: [{ executor: "self", text: "週末去爬一條 1 小時的步道", before: "會不會迷路？", after: "步道很好走，山頂有一位阿伯請我吃橘子。" }],
  },
  {
    email: "demo-social@demo.longjiao",
    name: "噗噗",
    look: { body: "round", accessory: "dragon_horns", main: "#CDB8DA", accent: "#F1DC8F", description: "長著小龍角的新鮮人" },
    personality: "內向，想交朋友",
    want: { text: "想主動跟新同事說話", districtKey: "social" },
    steps: [{ executor: "self", text: "午餐時問隔壁同事一個問題", before: "對方一定覺得我很奇怪。", after: "她其實也在等人跟她說話。" }],
  },
  {
    email: "demo-vol@demo.longjiao",
    name: "小幫手",
    look: { body: "tall", accessory: "scarf", main: "#E9AFB4", accent: "#B9CFA4", description: "很愛笑的退休阿姨" },
    personality: "閒不下來",
    want: { text: "想去當一次志工", districtKey: "volunteer" },
    steps: [{ executor: "self", text: "去食物銀行幫忙整理一個下午", after: "原來一個下午可以整理三百份物資。" }],
  },
  {
    email: "demo-misc@demo.longjiao",
    name: "什麼都想試",
    look: { body: "round", accessory: "none", main: "#F3E3C3", accent: "#A9C7DE", description: "背著大背包的旅人" },
    personality: "三分鐘熱度也沒關係",
    want: { text: "想學一個從來沒想過的東西", districtKey: "misc" },
    steps: [{ executor: "self", text: "去聽一場完全不懂的講座（天文）", after: "聽不太懂，但現在晚上會抬頭看星星。" }],
  },
];

interface DemoProvider {
  email: string;
  name: string;
  shop: { districtKey: string; name: string; roofColor: string; realAddress?: string; online?: boolean };
  trial: { title: string; durationMin: number; whenText: string; processInfo: string; aiFirstStepHint: string; selfFirstStepHint: string; description: string };
  faqs: { question: string; answer: string }[];
}

const PROVIDERS: DemoProvider[] = [
  {
    email: "demo-voice@demo.longjiao",
    name: "示範：小樹聲樂教室",
    shop: { districtKey: "music", name: "小樹聲樂教室", roofColor: "#E9AFB4", realAddress: "（示範地址）龍角鎮音樂坊 1 號" },
    trial: {
      title: "第一次聲樂試用課",
      durationMin: 50,
      whenText: "每週六 10:00",
      description: "給從來沒學過唱歌的人。",
      processInfo: "前十分鐘練呼吸，接著唱音階，最後選一首熟悉的歌。不會要你一個人在大家面前唱。",
      aiFirstStepHint: "請你的角色來問老師任何問題",
      selfFirstStepHint: "報名這週六的試用課",
    },
    faqs: [
      { question: "完全不會唱也可以嗎？", answer: "可以，大部分人第一次都會破音，這很正常。" },
      { question: "要準備什麼？", answer: "帶一瓶水就好。" },
    ],
  },
  {
    email: "demo-leo@demo.longjiao",
    name: "示範：Leo 的新手慢跑",
    shop: { districtKey: "sports", name: "Leo 慢跑站", roofColor: "#A8C8A0", realAddress: "（示範地址）河濱公園入口" },
    trial: {
      title: "新手 5K 慢跑",
      durationMin: 60,
      whenText: "每週日 07:00",
      description: "走跑交替也沒關係。",
      processInfo: "前 10 分鐘只做暖身；大約一半的人是第一次跑；最慢的人由我陪跑。",
      aiFirstStepHint: "來問 Leo 的 agent 任何問題",
      selfFirstStepHint: "報名這週日的慢跑",
    },
    faqs: [{ question: "跟不上怎麼辦？", answer: "可以走跑交替，我會陪最後一位。" }],
  },
  {
    email: "demo-clay@demo.longjiao",
    name: "示範：捏土小屋",
    shop: { districtKey: "crafts", name: "捏土小屋", roofColor: "#D8C0E0", realAddress: "（示範地址）手作巷 3 號" },
    trial: {
      title: "陶藝體驗：做一個杯子",
      durationMin: 90,
      whenText: "每週三晚上",
      description: "做歪了也很好看。",
      processInfo: "老師示範 15 分鐘，接著每個人捏一個杯子，燒好後一個月寄給你。",
      aiFirstStepHint: "請角色先問問會不會弄髒衣服",
      selfFirstStepHint: "報名一次體驗課",
    },
    faqs: [{ question: "會弄髒衣服嗎？", answer: "現場有圍裙可以借。" }],
  },
];

const DEMO_DOMAIN = "@demo.longjiao";

async function demoUser(ctx: AppContext, email: string, name: string) {
  const [u] = await ctx.db.insert(users).values({ id: newId("usr"), email, displayName: name, isDemo: true }).returning();
  return u;
}

function nextWeekday(now: Date, weekday: number, hourTaipei: number) {
  const d = new Date(now);
  d.setUTCHours(hourTaipei - 8, 0, 0, 0);
  const diff = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export async function seedDemo(ctx: AppContext): Promise<{ created: boolean }> {
  const [existing] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, PEOPLE[0].email));
  if (existing) return { created: false };

  const providerTrials: { trialId: string; districtKey: string }[] = [];
  for (const p of PROVIDERS) {
    const u = await demoUser(ctx, p.email, p.name);
    const applied = await applyProvider(ctx, u.id, { name: p.name, description: "這是示範用的提供者。" });
    await ctx.db.update(providers).set({ isDemo: true }).where(eq(providers.id, applied.id));
    await setProviderStatus(ctx, applied.id, "approved");
    const prov = (await getProviderByUser(ctx, u.id))!;
    const shop = await createShop(ctx, prov, p.shop);
    const trial = await createTrial(ctx, prov, { placeId: shop.id, ...p.trial, exitAnytime: true, buddyOk: true });
    for (const f of p.faqs) await addFaq(ctx, prov, trial.id, f);
    const now = ctx.now();
    for (const w of [1, 2]) {
      const start = nextWeekday(now, p.shop.districtKey === "sports" ? 0 : 6, 10);
      start.setUTCDate(start.getUTCDate() + (w - 1) * 7);
      await addSession(ctx, prov, trial.id, { startsAt: start.toISOString(), capacity: 12 });
    }
    providerTrials.push({ trialId: trial.id, districtKey: p.shop.districtKey });
  }

  for (const person of PEOPLE) {
    const u = await demoUser(ctx, person.email, person.name);
    await saveCharacter(ctx, u.id, { name: person.name, appearance: person.look, personality: person.personality, sharing: { allowAiQuotes: true } });
    await ctx.db.update(characters).set({ isDemo: true }).where(eq(characters.userId, u.id));
    const want = await addWant(ctx, u.id, person.want);
    const trial = providerTrials.find((t) => t.districtKey === person.want.districtKey);
    for (const s of person.steps) {
      const step = await createStep(ctx, u.id, { executor: s.executor, text: s.text, wantId: want.id, trialId: s.executor === "self" ? trial?.trialId : undefined, sourceDeedIds: [] });
      if (s.before) await upsertNote(ctx, u.id, step.id, "before", { body: s.before, shared: true });
      if (s.executor === "ai") await completeAiStep(ctx, u.id, step.id, s.result ?? "完成了");
      else await completeSelfStep(ctx, u.id, step.id, { noteAfter: s.after, noteShared: true, visibility: "public" });
    }
  }
  return { created: true };
}

export const isDemoEmail = (email: string) => email.endsWith(DEMO_DOMAIN);
