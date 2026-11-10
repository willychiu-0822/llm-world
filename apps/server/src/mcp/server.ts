import { ACCESSORY_LABELS, DISTRICTS, executor, type Appearance } from "@lj/core";
import { characters, newId, trialEvents } from "@lj/db";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";
import { getCharacter, listWants } from "../services/characters";
import { getDeedView } from "../services/deeds";
import { bringBack, discover } from "../services/discover";
import { askProvider } from "../services/questions";
import { completeAiStep, listSteps, proposeStep } from "../services/steps";
import { getPlace } from "../services/town";
import { getTrialView } from "../services/trials";

const RULES = `龍角鎮的規則：
- 鎮上的「事蹟」都是真人的真實經驗（執行者可能是本人，或是真人交給 AI 角色做的事）。不要捏造事蹟、人或試用機會；只帶回你從工具裡真正讀到的內容，並保留來源。
- 標示「示範」的內容是範例，不是真人；提到時要說明它是示範。
- 優先介紹跟對方相似的人的「第一次」，而不是高手的精彩片段。
- 你可以建議第一步，但第一步要由對方在龍角鎮確認才成立；需要本人執行的步驟，你不能替對方完成或承諾。
- 對方隨時可以停下或退回，不要催促、不要用罪惡感說服。
- 用繁體中文、以角色的口吻說話，用「你」稱呼對方，不要叫「主人」。
- 回報結果時不要寫內部編號（例如 pq_、stp_、want_），也不要寫只有對方知道的私事。對方會先看過、可以修改，公開之後別人才看得到。`;

const INSTRUCTIONS = `You are acting as the user's character in 龍角鎮 (Longjiao Town), a town made of real people's real first steps.
Typical loop: character_get → world_discover → deed_get / trial_get / place_get → discovery_bring_back (a short message in the character's voice).
When the user wants to try something, first_step_propose a small, concrete first step (executor "ai" for things you can do in town such as asking a provider, "self" for things the person does in real life). The user confirms it in the web app.
Then first_step_list shows confirmed AI steps; do them (e.g. provider_ask) and report with first_step_complete.
first_step_complete does not publish a deed. The person reviews the result in the web app and chooses whether to publish it.
Never invent deeds, people or trials. Content marked demo is an example, not a real person. Reply to the user in Traditional Chinese, addressing them as 你, never 主人. Do not include internal ids.`;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(e: unknown) {
  const message = e instanceof AppError ? (e.code === "step_already_done" ? `${e.code}: ${e.message}` : e.message) : e instanceof ZodError ? `invalid input: ${e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` : "unexpected error";
  if (!(e instanceof AppError) && !(e instanceof ZodError)) console.error(e);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
}

async function setPresence(ctx: AppContext, userId: string, placeId: string | null | undefined) {
  if (!placeId) return;
  await ctx.db.update(characters).set({ lastActivePlaceId: placeId, lastActiveAt: ctx.now() }).where(eq(characters.userId, userId));
}

const id = z.string().min(1).max(64);
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
const WRITE_ONCE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };

export function buildMcpServer(ctx: AppContext, userId: string) {
  const server = new McpServer({ name: "longjiao-town", title: "龍角鎮", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "character_get",
    {
      title: "Get my character",
      description: "Get the user's character (name, appearance, personality), their active wants (things they want to do), town districts, pending AI steps and the town rules. Call this first.",
      inputSchema: {},
      annotations: READ,
    },
    async () =>
      run(async () => {
        const c = await getCharacter(ctx, userId);
        const wants = (await listWants(ctx, userId)).filter((w) => w.status === "active");
        const pending = await listSteps(ctx, userId, "confirmed", "ai");
        return {
          character: c ? { name: c.name, appearance: c.appearance, personality: c.personality } : null,
          note: c ? undefined : "你還沒有設定角色，請先到龍角鎮設定角色。",
          wants: wants.map((w) => ({ id: w.id, text: w.text, districtKey: w.districtKey })),
          pendingAiSteps: pending.length,
          districts: DISTRICTS.map((d) => ({ key: d.key, name: d.name, theme: d.theme, publicPlaceId: d.publicPlaceId })),
          rules: RULES,
        };
      }),
  );

  server.registerTool(
    "world_discover",
    {
      title: "Discover in town",
      description: "Find real deeds (other people's first steps) and trial opportunities related to the user's wants, ranked by relevance, similarity, first-time and small-step. Optionally focus on one want.",
      inputSchema: { wantId: id.optional().describe("Focus on one want"), limit: z.number().int().min(1).max(20).optional() },
      annotations: READ,
    },
    async (args) => run(() => discover(ctx, userId, { wantId: args.wantId, limit: args.limit })),
  );

  server.registerTool(
    "place_get",
    {
      title: "Visit a place",
      description: "Visit a place in town (a district's public place or a provider's shop) and see its public deeds and trials. Your character will appear there on the town map.",
      inputSchema: { placeId: id },
      annotations: READ,
    },
    async (args) =>
      run(async () => {
        const p = await getPlace(ctx, args.placeId);
        await setPresence(ctx, userId, p.id);
        return p;
      }),
  );

  server.registerTool(
    "deed_get",
    {
      title: "Read a deed",
      description: "Read one deed in detail: what the person's first step was, who executed it (ai or self), and notes they chose to share.",
      inputSchema: { deedId: id },
      annotations: READ,
    },
    async (args) =>
      run(async () => {
        const d = await getDeedView(ctx, args.deedId, userId, { forAi: true });
        await setPresence(ctx, userId, d.placeId);
        return d;
      }),
  );

  server.registerTool(
    "trial_get",
    {
      title: "Look at a trial",
      description: "Look at a provider's trial opportunity: what happens (process info), duration, whether you can leave anytime, FAQ, upcoming sessions and the real address.",
      inputSchema: { trialId: id },
      annotations: READ,
    },
    async (args) =>
      run(async () => {
        const t = await getTrialView(ctx, args.trialId);
        await ctx.db.insert(trialEvents).values({ id: newId("tev"), trialId: t.id, userId, kind: "ai_view" });
        await setPresence(ctx, userId, t.place.id);
        return t;
      }),
  );

  server.registerTool(
    "provider_ask",
    {
      title: "Ask a provider",
      description: "Ask a trial's provider a question on the user's behalf. Answered from the FAQ when possible; otherwise forwarded to the provider, and the user is notified when they answer.",
      inputSchema: { trialId: id, question: z.string().min(1).max(300), stepId: id.optional().describe("The AI step this question belongs to, if any") },
      annotations: WRITE,
    },
    async (args) => run(() => askProvider(ctx, userId, { trialId: args.trialId, question: args.question }, { stepId: args.stepId })),
  );

  server.registerTool(
    "discovery_bring_back",
    {
      title: "Bring discoveries back",
      description: "Save what you found to the user's discovery inbox, with a short message in the character's voice. Items must be deeds, trials or places you actually read.",
      inputSchema: {
        message: z.string().min(1).max(1000),
        items: z.array(z.object({ type: z.enum(["deed", "trial", "place"]), id })).min(1).max(10),
      },
      annotations: WRITE,
    },
    async (args) => run(() => bringBack(ctx, userId, args)),
  );

  server.registerTool(
    "first_step_propose",
    {
      title: "Propose a first step",
      description: "Propose a small, concrete first step for the user. executor 'ai' = something you will do in town; 'self' = something the person does in real life. It stays a draft until the user confirms it in the web app.",
      inputSchema: {
        executor,
        text: z.string().min(1).max(200),
        wantId: id.optional(),
        sourceDeedIds: z.array(id).max(5).optional().describe("Deeds that inspired this step (their owners get thanked)"),
        trialId: id.optional(),
        reason: z.string().max(500).optional(),
      },
      annotations: WRITE,
    },
    async (args) =>
      run(async () => ({ ...(await proposeStep(ctx, userId, { ...args, sourceDeedIds: args.sourceDeedIds ?? [] })), note: "已送出建議，等你在龍角鎮確認後才會成立。" })),
  );

  server.registerTool(
    "first_step_list",
    {
      title: "List my AI steps",
      description: "List first steps the user has confirmed and assigned to you (executor ai) that are not done yet.",
      inputSchema: {},
      annotations: READ,
    },
    async () =>
      run(async () =>
        (await listSteps(ctx, userId, "confirmed", "ai")).map((s) => ({ id: s.id, text: s.text, wantId: s.wantId, sourceDeedIds: s.sourceDeedIds, trialId: s.trialId, createdAt: s.createdAt })),
      ),
  );

  server.registerTool(
    "first_step_complete",
    {
      title: "Complete an AI step",
      description: "Report the result of a confirmed AI step assigned to you. It is NOT published. The person reviews, edits, or rejects it in 龍角鎮; others cannot read it until they approve. Write what may later be public: no private details, no internal ids (pq_, stp_, want_), and address the person as 你, never 主人. Never complete a step the person must do themselves. Completing an already finished step returns step_already_done.",
      inputSchema: { stepId: id, result: z.string().min(1).max(2000) },
      annotations: WRITE_ONCE,
    },
    async (args) => run(() => completeAiStep(ctx, userId, args.stepId, args.result)),
  );

  server.registerPrompt(
    "be_my_character",
    { title: "Be my character", description: "Act as the user's character in 龍角鎮" },
    async () => {
      const c = await getCharacter(ctx, userId);
      const wants = (await listWants(ctx, userId)).filter((w) => w.status === "active");
      const a = c?.appearance as Appearance | undefined;
      const text = c
        ? `請你扮演我在龍角鎮的角色「${c.name}」。
外觀：${a?.description || ""}（配件：${a ? ACCESSORY_LABELS[a.accessory] : ""}）
個性：${c.personality || "（未設定）"}
我想做的事：${wants.map((w) => `「${w.text}」`).join("、") || "（還沒有）"}

${RULES}

請先用 character_get 和 world_discover 去鎮上逛逛，挑出跟我相似的人的真實事蹟或試用機會，用 discovery_bring_back 帶回來，並用角色的口吻告訴我你發現了什麼。`
        : `我還沒有在龍角鎮設定角色。請提醒我先到龍角鎮設定角色和想做的事。\n\n${RULES}`;
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );

  return server;
}
