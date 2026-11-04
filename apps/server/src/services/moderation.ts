import { moderationLog, newId } from "@lj/db";
import type { AppContext } from "../context";
import { AppError } from "../http/errors";

/** Runs public text through the moderation pipeline; returns the (possibly masked) text or throws. */
export async function moderate(ctx: AppContext, text: string, meta: { userId?: string; targetType: string }): Promise<string> {
  const r = await ctx.moderator.check(text, meta);
  if (r.flagged) {
    await ctx.db.insert(moderationLog).values({
      id: newId("mod"),
      userId: meta.userId ?? null,
      targetType: meta.targetType,
      excerpt: text.slice(0, 200),
      categories: r.categories,
      action: r.action === "allow" ? "log" : r.action,
    });
  }
  if (r.action === "block") throw new AppError("moderation_blocked", "內容不符合社群規範", { categories: r.categories });
  return r.text;
}

export async function moderateOptional(ctx: AppContext, text: string | undefined, meta: { userId?: string; targetType: string }) {
  return text === undefined || text === "" ? text : moderate(ctx, text, meta);
}
