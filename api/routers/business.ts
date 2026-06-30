import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { businesses } from "@db/schema";
import { eq, like, and, desc, sql } from "drizzle-orm";

export const businessRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional().default(""),
        city: z.string().optional().default(""),
        industry: z.string().optional().default(""),
        hasWebsite: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).default({ search: "", city: "", industry: "", limit: 50, offset: 0 })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const conditions = [];
      if (input.search) {
        conditions.push(like(businesses.name, `%${input.search}%`));
      }
      if (input.city) {
        conditions.push(like(businesses.city, `%${input.city}%`));
      }
      if (input.industry) {
        conditions.push(eq(businesses.industry, input.industry));
      }
      if (input.hasWebsite !== undefined) {
        conditions.push(eq(businesses.hasWebsite, input.hasWebsite ? 1 : 0));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(businesses)
        .where(where)
        .orderBy(desc(businesses.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(businesses)
        .where(where);

      return {
        items: results,
        total: countResult[0]?.count || 0,
      };
    }),

  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, input.id))
        .limit(1);
      return result[0] || null;
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(businesses).where(eq(businesses.id, input.id));
      return { success: true };
    }),

  stats: publicQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: sql<number>`count(*)` }).from(businesses);
    const withWebsite = await db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(eq(businesses.hasWebsite, 1));
    const withoutWebsite = await db
      .select({ count: sql<number>`count(*)` })
      .from(businesses)
      .where(eq(businesses.hasWebsite, 0));

    return {
      total: total[0]?.count || 0,
      withWebsite: withWebsite[0]?.count || 0,
      withoutWebsite: withoutWebsite[0]?.count || 0,
    };
  }),
});
