import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { scoutJobs, businesses, leads, userSettings } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { searchBusinessesWithKey, guessIndustry } from "../services/google-places";
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
  execute: authedQuery
    .input(z.object({
      query: z.string().min(1),
      location: z.string().optional(),
      kimiApiKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.user;

      // Read API keys from settings
      const settings = await db.select().from(userSettings).limit(1);
      const googleKey = settings[0]?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || "";
      const kimiKey = input.kimiApiKey || settings[0]?.kimiApiKey || "";

      if (!googleKey) {
        return { leadsFound: 0, totalScanned: 0, message: "Google Places API key not configured. Add it in Settings > API Keys." };
      }

      // 1. Search Google Places for real businesses
      const places = await searchBusinessesWithKey(googleKey, input.query, input.location, 20);

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

          // Insert business with returning ID
          const bizReturning = await db.insert(businesses).values({
            externalId: place.placeId,
            name: place.name,
            address: place.address,
            phone: place.phone,
            website: place.website,
            industry,
            description: place.types?.join(", "),
            openingHours: place.openingHours,
            googleRating: place.rating,
            reviewCount: place.reviewCount,
            latitude: place.latitude,
            longitude: place.longitude,
            city: input.location || null,
            hasWebsite: place.website ? 1 : 0,
          }).returning({ id: businesses.id });

          const businessId = bizReturning[0]?.id;
          if (!businessId) continue;

          // Create lead with returning ID, scoped to current user
          const leadResult = await db.insert(leads).values({
            businessId,
            userId: user.id,
            authType: user.authType,
            status: "new",
            stage: "research",
            tags: [industry, input.location || "general"].filter(Boolean),
          }).returning({ id: leads.id });

          const leadId = leadResult[0]?.id;
          if (!leadId) continue;
          leadsFound++;

          // If Kimi API key is available, do AI analysis in background
          if (kimiKey) {
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
                kimiKey,
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
        message: `Found ${leadsFound} new businesses${kimiKey ? " with AI analysis" : ""}`,
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
