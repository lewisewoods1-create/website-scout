import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./auth-router";
import { localAuthRouter } from "./routers/local-auth";
import { adminRouter } from "./routers/admin";
import { businessRouter } from "./routers/business";
import { leadRouter } from "./routers/lead";
import { scoutRouter } from "./routers/scout";
import { outreachRouter } from "./routers/outreach";
import { settingsRouter } from "./routers/settings";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  localAuth: localAuthRouter,
  admin: adminRouter,
  business: businessRouter,
  lead: leadRouter,
  scout: scoutRouter,
  outreach: outreachRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
