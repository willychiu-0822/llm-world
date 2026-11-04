import { newId, users } from "@lj/db";
import { eq, or } from "drizzle-orm";
import type { AppContext } from "../context";

export async function upsertUser(ctx: AppContext, p: { email: string; name: string; googleSub?: string }) {
  const email = p.email.trim().toLowerCase();
  const isAdmin = ctx.config.adminEmails.includes(email);
  const cond = p.googleSub ? or(eq(users.googleSub, p.googleSub), eq(users.email, email)) : eq(users.email, email);
  const [existing] = await ctx.db.select().from(users).where(cond).limit(1);
  if (existing) {
    const roles = new Set(existing.roles);
    if (isAdmin) roles.add("admin");
    const [u] = await ctx.db
      .update(users)
      .set({ roles: [...roles], googleSub: existing.googleSub ?? p.googleSub ?? null, displayName: existing.displayName || p.name })
      .where(eq(users.id, existing.id))
      .returning();
    return u;
  }
  const [u] = await ctx.db
    .insert(users)
    .values({ id: newId("usr"), email, displayName: p.name, googleSub: p.googleSub ?? null, roles: isAdmin ? ["user", "admin"] : ["user"] })
    .returning();
  return u;
}

export async function deleteUser(ctx: AppContext, userId: string) {
  await ctx.db.delete(users).where(eq(users.id, userId));
}
