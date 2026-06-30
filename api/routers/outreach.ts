import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { emailDrafts, businesses, leads } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { generateOutreach } from "../services/kimi";

export const outreachRouter = createRouter({
  // ── Generate outreach content via Kimi AI ──
  generate: publicQuery
    .input(z.object({
      leadId: z.number(),
      type: z.enum(["cold_email", "linkedin", "facebook", "phone_script", "followup1", "followup2", "proposal"]),
      kimiApiKey: z.string().min(1),
      model: z.string().default("kimi-latest"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get lead + business data
      const leadResult = await db
        .select()
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);

      if (!leadResult[0]) {
        throw new Error("Lead not found");
      }

      const biz = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, leadResult[0].businessId))
        .limit(1);

      if (!biz[0]) {
        throw new Error("Business not found");
      }

      const business = biz[0];

      // Generate content via Kimi
      const content = await generateOutreach(
        input.kimiApiKey,
        input.type,
        business.name,
        business.owner || "there",
        business.industry || "Business",
        !!business.website,
        business.website,
        business.googleRating || 0,
        business.reviewCount || 0,
        business.city || "",
        input.model,
      );

      if (!content) {
        throw new Error("Failed to generate outreach content");
      }

      // Save as draft
      // Extract subject from content if email
      let subject = null;
      let body = content;
      const subjectMatch = content.match(/Subject:\s*(.+)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = content.replace(/Subject:.+\n?/i, "").trim();
      }

      await db.insert(emailDrafts).values({
        leadId: input.leadId,
        type: input.type,
        subject,
        body,
      });

      return { content, subject, body, type: input.type };
    }),

  // ── List drafts for a lead ──
  list: publicQuery
    .input(z.object({ leadId: z.number() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.leadId) {
        return db
          .select()
          .from(emailDrafts)
          .where(eq(emailDrafts.leadId, input.leadId))
          .orderBy(desc(emailDrafts.createdAt));
      }
      return db.select().from(emailDrafts).orderBy(desc(emailDrafts.createdAt));
    }),

  // ── Get single draft ──
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(emailDrafts)
        .where(eq(emailDrafts.id, input.id))
        .limit(1);
      return result[0] || null;
    }),
});
