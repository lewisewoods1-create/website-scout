import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { scoutJobs, businesses, leads } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { searchBusinesses, guessIndustry } from "../services/google-places";
import { analyseWebsite as analyseWebsiteService } from "../services/website-analysis";
import { analyseWebsite as kimiAnalyse } from "../services/kimi";

export const scoutRouter = createRouter({
  // ── List scout jobs ──
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(scoutJobs).orderBy(desc(scoutJobs.createdAt));
  }),

  // ── Create a new scout job ──
  create: publicQuery
    .input(z.object({
      query: z.string().min(1),
      location: z.string().optional(),
      industry: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(scoutJobs).values({
        query: input.query,
        location: input.location || null,
        industry: input.industry || null,
        status: "running",
        progress: 0,
        sourcesScanned: 0,
        currentSource: "Google Places",
      });
      return { id: Number(result[0].insertId) };
    }),

  // ── Execute a search (find real businesses) ──
  execute: publicQuery
    .input(z.object({
      query: z.string().min(1),
      location: z.string().optional(),
      kimiApiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // 1. Search Google Places for real businesses
      const places = await searchBusinesses(input.query, input.location, 20);

      let leadsFound = 0;

      // 2. For each business, save to DB and optionally analyse
      for (const place of places) {
        try {
          // Check if business already exists
          const existing = await db
            .select()
            .from(businesses)
            .where(eq(businesses.externalId, place.placeId))
            .limit(1);

          if (existing[0]) continue; // Skip duplicates

          const industry = guessIndustry(place.types);

          // Insert business
          const bizResult = await db.insert(businesses).values({
            externalId: place.placeId,
            name: place.name,
            address: place.address,
            phone: place.phone,
            website: place.website,
            industry,
            openingHours: place.openingHours,
            googleRating: place.rating,
            reviewCount: place.reviewCount,
            latitude: place.latitude,
            longitude: place.longitude,
            city: input.location || null,
            hasWebsite: place.website ? 1 : 0,
          });

          const businessId = Number(bizResult[0].insertId);

          // Create lead
          const leadResult = await db.insert(leads).values({
            businessId,
            status: "new",
            stage: "research",
            tags: [industry, input.location || "general"].filter(Boolean),
          });

          const leadId = Number(leadResult[0].insertId);
          leadsFound++;

          // If Kimi API key is provided, do AI analysis in background
          if (input.kimiApiKey) {
            try {
              // Website tech analysis
              if (place.website) {
                const techAnalysis = await analyseWebsiteService(place.website);

                // Update business with tech findings
                await db.update(businesses)
                  .set({ hasWebsite: techAnalysis.hasWebsite ? 1 : 0 })
                  .where(eq(businesses.id, businessId));
              }

              // Kimi AI analysis for scoring
              const kimiResult = await kimiAnalyse(
                input.kimiApiKey,
                place.name,
                place.website || null,
                industry,
              );

              if (kimiResult) {
                // Update lead with scores
                await db.update(leads).set({
                  overallScore: kimiResult.overallScore,
                  websiteScore: kimiResult.websiteScore,
                  seoScore: kimiResult.seoScore,
                  performanceScore: kimiResult.performanceScore,
                  designScore: kimiResult.designScore,
                  brandScore: kimiResult.brandScore,
                  marketingScore: kimiResult.marketingScore,
                  conversionScore: kimiResult.conversionScore,
                  localPresenceScore: kimiResult.localPresenceScore,
                  growthPotential: kimiResult.growthPotential,
                  salesProbability: kimiResult.salesProbability,
                  priority: kimiResult.priority,
                }).where(eq(leads.id, leadId));

                // Save detailed analysis
                await db.insert(scoutJobs).values({
                  query: `analysis_${businessId}`,
                  status: "completed",
                  progress: 100,
                  currentSource: "Kimi AI",
                }).catch(() => {}); // Non-critical
              }
            } catch (err) {
              console.error("AI analysis failed for", place.name, err);
            }
          }
        } catch (err) {
          console.error("Failed to process business:", place.name, err);
        }
      }

      return {
        leadsFound,
        totalScanned: places.length,
        message: `Found ${leadsFound} new businesses${input.kimiApiKey ? " with AI analysis" : ""}`,
      };
    }),

  // ── Update job status ──
  updateStatus: publicQuery
    .input(z.object({
      id: z.number(),
      status: z.string(),
      progress: z.number().optional(),
      error: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(scoutJobs).set(data).where(eq(scoutJobs.id, id));
      return { success: true };
    }),
});
