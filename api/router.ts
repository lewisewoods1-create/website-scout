import { createRouter, publicQuery } from "./middleware";
import { businessRouter } from "./routers/business";
import { leadRouter } from "./routers/lead";
import { scoutRouter } from "./routers/scout";
import { outreachRouter } from "./routers/outreach";
import { settingsRouter } from "./routers/settings";
import { authRouter } from "./auth-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,

  business: businessRouter,
  lead: leadRouter,
  scout: scoutRouter,
  outreach: outreachRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
