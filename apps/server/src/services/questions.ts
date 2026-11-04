import { bestMatch, providerAskInput } from "@lj/core";
import { newId, providerQuestions, providers, trialEvents, trialFaqs } from "@lj/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "../context";
import { moderate } from "./moderation";
import { notify } from "./notifications";
import { getUsableTrial } from "./steps";

/** A user's AI asks a provider: answer from the FAQ when possible, else forward to the provider. */
export async function askProvider(ctx: AppContext, userId: string, raw: unknown, opts: { stepId?: string } = {}) {
  const input = providerAskInput.parse(raw);
  const { trial } = await getUsableTrial(ctx, input.trialId);
  await ctx.db.insert(trialEvents).values({ id: newId("tev"), trialId: trial.id, userId, kind: "question" });
  const faqs = await ctx.db.select().from(trialFaqs).where(eq(trialFaqs.trialId, trial.id));
  const match = bestMatch(input.question, faqs.map((f) => ({ ...f, text: f.question })));
  const question = await moderate(ctx, input.question, { userId, targetType: "question" });
  if (match) {
    await ctx.db.insert(providerQuestions).values({ id: newId("pq"), trialId: trial.id, askerUserId: userId, firstStepId: opts.stepId ?? null, question, source: "faq", answer: match.answer, answeredAt: ctx.now() });
    return { answered: true as const, source: "faq" as const, question: match.question, answer: match.answer };
  }
  const [q] = await ctx.db
    .insert(providerQuestions)
    .values({ id: newId("pq"), trialId: trial.id, askerUserId: userId, firstStepId: opts.stepId ?? null, question })
    .returning();
  const [p] = await ctx.db.select({ userId: providers.userId }).from(providers).where(eq(providers.id, trial.providerId));
  if (p) await notify(ctx, p.userId, "new_question", { trialId: trial.id, questionId: q.id, question });
  return {
    answered: false as const,
    questionId: q.id,
    processInfo: trial.processInfo,
    message: "常見問答裡沒有這個問題，已經轉給提供者。提供者回答後，主人會在龍角鎮收到通知。",
  };
}
