import { newId, notifications } from "@lj/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { AppContext } from "../context";

export type NotificationKind =
  | "followed_referenced"
  | "followed_completed"
  | "step_proposed"
  | "ai_step_done"
  | "question_answered"
  | "attendance_confirmed"
  | "provider_approved"
  | "new_question";

export async function notify(ctx: AppContext, userId: string, kind: NotificationKind, payload: Record<string, unknown>) {
  await ctx.db.insert(notifications).values({ id: newId("ntf"), userId, kind, payload, createdAt: ctx.now() });
}

export async function listNotifications(ctx: AppContext, userId: string) {
  return ctx.db
    .select({ id: notifications.id, kind: notifications.kind, payload: notifications.payload, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(50);
}

export async function readAllNotifications(ctx: AppContext, userId: string) {
  await ctx.db.update(notifications).set({ readAt: ctx.now() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
