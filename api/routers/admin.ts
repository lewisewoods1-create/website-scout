import { z } from "zod";
import { eq, count, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [businessCount] = await db.select({ value: count() }).from(schema.businesses);
    const [leadCount] = await db.select({ value: count() }).from(schema.leads);
    const [userCount] = await db.select({ value: count() }).from(schema.users);
    const [localUserCount] = await db.select({ value: count() }).from(schema.localUsers);
    const [scoutCount] = await db.select({ value: count() }).from(schema.scoutJobs);
    const [draftCount] = await db.select({ value: count() }).from(schema.emailDrafts);

    return {
      businesses: businessCount.value,
      leads: leadCount.value,
      oauthUsers: userCount.value,
      localUsers: localUserCount.value,
      scoutJobs: scoutCount.value,
      emailDrafts: draftCount.value,
    };
  }),

  users: adminQuery
    .input(
      z
        .object({
          type: z.enum(["oauth", "local", "all"]).default("all"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const type = input?.type ?? "all";

      const oauthUsers =
        type === "oauth" || type === "all"
          ? await db
              .select({
                id: schema.users.id,
                name: schema.users.name,
                email: schema.users.email,
                role: schema.users.role,
                createdAt: schema.users.createdAt,
                lastSignInAt: schema.users.lastSignInAt,
              })
              .from(schema.users)
          : [];

      const localUsersList =
        type === "local" || type === "all"
          ? await db
              .select({
                id: schema.localUsers.id,
                name: schema.localUsers.name,
                email: schema.localUsers.email,
                role: schema.localUsers.role,
                emailConfirmed: schema.localUsers.emailConfirmed,
                createdAt: schema.localUsers.createdAt,
                lastSignInAt: schema.localUsers.lastSignInAt,
              })
              .from(schema.localUsers)
          : [];

      return {
        oauth: oauthUsers.map((u) => ({ ...u, type: "oauth" as const })),
        local: localUsersList.map((u) => ({
          ...u,
          type: "local" as const,
          emailConfirmed: u.emailConfirmed === 1,
        })),
      };
    }),

  updateUserRole: adminQuery
    .input(
      z.object({
        userId: z.number(),
        type: z.enum(["oauth", "local"]),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.type === "oauth") {
        await db
          .update(schema.users)
          .set({ role: input.role })
          .where(eq(schema.users.id, input.userId));
      } else {
        await db
          .update(schema.localUsers)
          .set({ role: input.role })
          .where(eq(schema.localUsers.id, input.userId));
      }
      return { success: true };
    }),

  recentActivity: adminQuery.query(async () => {
    const db = getDb();
    const recentScouts = await db
      .select()
      .from(schema.scoutJobs)
      .orderBy(sql`${schema.scoutJobs.createdAt} DESC`)
      .limit(10);
    const recentLeads = await db
      .select()
      .from(schema.leads)
      .orderBy(sql`${schema.leads.createdAt} DESC`)
      .limit(10);
    return { scouts: recentScouts, leads: recentLeads };
  }),

  deleteUser: adminQuery
    .input(
      z.object({
        userId: z.number(),
        type: z.enum(["oauth", "local"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.type === "oauth") {
        await db.delete(schema.users).where(eq(schema.users.id, input.userId));
      } else {
        await db.delete(schema.localUsers).where(eq(schema.localUsers.id, input.userId));
      }
      return { success: true };
    }),
});
