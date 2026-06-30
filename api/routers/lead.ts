import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { leads, businesses, websiteAnalyses, notes } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const leadRouter = createRouter({
  list: publicQuery
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
    .query(async ({ input }) => {
      const db = getDb();

      const conditions = [];
      if (input.stage) conditions.push(eq(leads.stage, input.stage));
      if (input.priority) conditions.push(eq(leads.priority, input.priority));
      if (input.status) conditions.push(eq(leads.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

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

  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const leadResult = await db
        .select()
        .from(leads)
        .where(eq(leads.id, input.id))
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

  create: publicQuery
    .input(z.object({
      businessId: z.number(),
      status: z.string().default("new"),
      stage: z.string().default("research"),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(leads).values({
        businessId: input.businessId,
        status: input.status,
        stage: input.stage,
        tags: input.tags || [],
      });
      return { id: Number(result[0].insertId) };
    }),

  update: publicQuery
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      stage: z.string().optional(),
      priority: z.string().optional(),
      tags: z.array(z.string()).optional(),
      revenue: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(leads).set(data).where(eq(leads.id, id));
      return { success: true };
    }),

  updateScores: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(leads).set(data).where(eq(leads.id, id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(notes).where(eq(notes.leadId, input.id));
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  pipeline: publicQuery.query(async () => {
    const db = getDb();
    const stages = ["research", "contacted", "negotiation", "won", "lost"];
    const stats: Record<string, number> = {};

    for (const stage of stages) {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(eq(leads.stage, stage));
      stats[stage] = result[0]?.count || 0;
    }

    const revenue = await db
      .select({ total: sql<number>`COALESCE(SUM(revenue), 0)` })
      .from(leads)
      .where(eq(leads.stage, "won"));

    return { stages: stats, totalRevenue: revenue[0]?.total || 0 };
  }),

  addNote: publicQuery
    .input(z.object({
      leadId: z.number(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(notes).values({
        leadId: input.leadId,
        content: input.content,
      });
      return { success: true };
    }),
});
