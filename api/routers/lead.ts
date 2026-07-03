import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { leads, businesses, websiteAnalyses, notes } from "@db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

export const leadRouter = createRouter({
  // List leads for the current user
  list: authedQuery
    .input(
      z.object({
        search: z.string().optional().default(""),
        stage: z.string().optional().default(""),
        priority: z.string().optional().default(""),
        status: z.string().optional().default(""),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).default({ search: "", stage: "", priority: "", status: "", limit: 50, offset: 0 })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.user;

      // Filter by user ownership (or null for backwards compat)
      const userFilter = and(
        eq(leads.userId, user.id),
        eq(leads.authType, user.authType)
      );

      const conditions = [userFilter];
      if (input.stage) conditions.push(eq(leads.stage, input.stage));
      if (input.priority) conditions.push(eq(leads.priority, input.priority));
      if (input.status) conditions.push(eq(leads.status, input.status));

      const where = and(...conditions);

      const leadResults = await db
        .select()
        .from(leads)
        .where(where)
        .orderBy(desc(leads.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const enriched = [];
      for (const lead of leadResults) {
        const biz = await db
          .select()
          .from(businesses)
          .where(eq(businesses.id, lead.businessId))
          .limit(1);

        if (biz[0]) {
          if (input.search && !biz[0].name.toLowerCase().includes(input.search.toLowerCase())) {
            continue;
          }
          enriched.push({ ...lead, business: biz[0] });
        }
      }

      return { items: enriched, total: enriched.length };
    }),

  // Get a single lead (must belong to current user)
  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.user;

      const leadResult = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.id, input.id),
            eq(leads.userId, user.id),
            eq(leads.authType, user.authType)
          )
        )
        .limit(1);

      if (!leadResult[0]) return null;

      const biz = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, leadResult[0].businessId))
        .limit(1);

      const analysis = await db
        .select()
        .from(websiteAnalyses)
        .where(eq(websiteAnalyses.businessId, leadResult[0].businessId))
        .limit(1);

      const noteList = await db
        .select()
        .from(notes)
        .where(eq(notes.leadId, input.id))
        .orderBy(desc(notes.createdAt));

      return {
        ...leadResult[0],
        business: biz[0] || null,
        analysis: analysis[0] || null,
        notes: noteList,
      };
    }),

  create: authedQuery
    .input(z.object({
      businessId: z.number(),
      status: z.string().default("new"),
      stage: z.string().default("research"),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db.insert(leads).values({
        businessId: input.businessId,
        userId: ctx.user.id,
        authType: ctx.user.authType,
        status: input.status,
        stage: input.stage,
        tags: input.tags || [],
      }).returning({ id: leads.id });
      return { id: result[0]?.id };
    }),

  update: authedQuery
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      stage: z.string().optional(),
      priority: z.string().optional(),
      tags: z.array(z.string()).optional(),
      revenue: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(leads)
        .set(data)
        .where(
          and(
            eq(leads.id, id),
            eq(leads.userId, ctx.user.id),
            eq(leads.authType, ctx.user.authType)
          )
        );
      return { success: true };
    }),

  updateScores: authedQuery
    .input(z.object({
      id: z.number(),
      overallScore: z.number().optional(),
      websiteScore: z.number().optional(),
      seoScore: z.number().optional(),
      performanceScore: z.number().optional(),
      designScore: z.number().optional(),
      brandScore: z.number().optional(),
      marketingScore: z.number().optional(),
      conversionScore: z.number().optional(),
      localPresenceScore: z.number().optional(),
      growthPotential: z.number().optional(),
      salesProbability: z.number().optional(),
      priority: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(leads)
        .set(data)
        .where(
          and(
            eq(leads.id, id),
            eq(leads.userId, ctx.user.id),
            eq(leads.authType, ctx.user.authType)
          )
        );
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(notes).where(eq(notes.leadId, input.id));
      await db.delete(leads)
        .where(
          and(
            eq(leads.id, input.id),
            eq(leads.userId, ctx.user.id),
            eq(leads.authType, ctx.user.authType)
          )
        );
      return { success: true };
    }),

  // Pipeline stats for the current user only
  pipeline: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = ctx.user;
    const userFilter = and(
      eq(leads.userId, user.id),
      eq(leads.authType, user.authType)
    );

    const stages = ["research", "contacted", "negotiation", "won", "lost"];
    const stats: Record<string, number> = {};

    for (const stage of stages) {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(userFilter, eq(leads.stage, stage)));
      stats[stage] = result[0]?.count || 0;
    }

    const revenue = await db
      .select({ total: sql<number>`COALESCE(SUM(revenue), 0)` })
      .from(leads)
      .where(and(userFilter, eq(leads.stage, "won")));

    return { stages: stats, totalRevenue: revenue[0]?.total || 0 };
  }),

  addNote: authedQuery
    .input(z.object({
      leadId: z.number(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Verify lead belongs to user
      const leadResult = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.id, input.leadId),
            eq(leads.userId, ctx.user.id),
            eq(leads.authType, ctx.user.authType)
          )
        )
        .limit(1);

      if (!leadResult[0]) {
        throw new Error("Lead not found");
      }

      await db.insert(notes).values({
        leadId: input.leadId,
        content: input.content,
      });
      return { success: true };
    }),
});
