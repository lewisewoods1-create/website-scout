import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { userSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { testConnection } from "../services/kimi";

export const settingsRouter = createRouter({
  // ── Get settings (by email as user ID for now) ──
  get: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.email, input.email))
        .limit(1);
      return result[0] || null;
    }),

  // ── Upsert settings ──
  upsert: publicQuery
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      company: z.string().optional(),
      notifications: z.boolean().optional(),
      dailyDigest: z.boolean().optional(),
      weeklyReport: z.boolean().optional(),
      kimiApiKey: z.string().optional(),
      kimiEndpoint: z.string().optional(),
      kimiModel: z.string().optional(),
      kimiEnabled: z.boolean().optional(),
      googlePlacesApiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.email, input.email))
        .limit(1);

      const data = {
        name: input.name,
        company: input.company,
        notifications: input.notifications !== undefined ? (input.notifications ? 1 : 0) : undefined,
        dailyDigest: input.dailyDigest !== undefined ? (input.dailyDigest ? 1 : 0) : undefined,
        weeklyReport: input.weeklyReport !== undefined ? (input.weeklyReport ? 1 : 0) : undefined,
        kimiApiKey: input.kimiApiKey,
        kimiEndpoint: input.kimiEndpoint,
        kimiModel: input.kimiModel,
        kimiEnabled: input.kimiEnabled !== undefined ? (input.kimiEnabled ? 1 : 0) : undefined,
        googlePlacesApiKey: input.googlePlacesApiKey,
      };

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      if (existing[0]) {
        await db
          .update(userSettings)
          .set(cleanData)
          .where(eq(userSettings.email, input.email));
      } else {
        await db.insert(userSettings).values({
          email: input.email,
          ...cleanData,
        });
      }

      return { success: true };
    }),

  // ── Test Kimi connection ──
  testKimi: publicQuery
    .input(z.object({
      apiKey: z.string().min(1),
      endpoint: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return testConnection(input.apiKey, input.endpoint);
    }),

  // ── Get API keys (masked) ──
  getKeys: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.email, input.email))
        .limit(1);

      if (!result[0]) return { kimiConfigured: false, googleConfigured: false };

      return {
        kimiConfigured: !!result[0].kimiApiKey,
        kimiEnabled: result[0].kimiEnabled === 1,
        googleConfigured: !!result[0].googlePlacesApiKey,
      };
    }),
});
