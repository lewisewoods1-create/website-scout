import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { initDb } from "./queries/connection";

// Initialize database on startup
initDb();

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// tRPC handler — properly copy response headers (cookies) back to Hono
app.use("/api/trpc/*", async (c) => {
  const trpcResponse = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
  // Copy all headers from tRPC response (including set-cookie)
  trpcResponse.headers.forEach((value, key) => {
    c.header(key, value);
  });
  return c.body(trpcResponse.body, trpcResponse.status as any);
});

// Debug REST endpoints — bypass tRPC for direct DB inspection
import { getDb } from "./queries/connection";
import { leads, businesses, localUsers, users, scoutJobs } from "@db/schema";
import { sql, desc } from "drizzle-orm";

app.get("/api/debug/leads", async (c) => {
  try {
    const db = getDb();
    const allLeads = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50);
    const allBiz = await db.select().from(businesses).limit(50);
    const leadCount = await db.select({ count: sql<number>`count(*)` }).from(leads);
    const bizCount = await db.select({ count: sql<number>`count(*)` }).from(businesses);
    return c.json({
      leadCount: leadCount[0]?.count ?? 0,
      businessCount: bizCount[0]?.count ?? 0,
      leads: allLeads,
      businesses: allBiz,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/debug/stats", async (c) => {
  try {
    const db = getDb();
    const leadCount = await db.select({ count: sql<number>`count(*)` }).from(leads);
    const bizCount = await db.select({ count: sql<number>`count(*)` }).from(businesses);
    const oauthCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const localCount = await db.select({ count: sql<number>`count(*)` }).from(localUsers);
    const jobCount = await db.select({ count: sql<number>`count(*)` }).from(scoutJobs);
    return c.json({
      leads: leadCount[0]?.count ?? 0,
      businesses: bizCount[0]?.count ?? 0,
      oauthUsers: oauthCount[0]?.count ?? 0,
      localUsers: localCount[0]?.count ?? 0,
      scoutJobs: jobCount[0]?.count ?? 0,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// Production server setup — no top-level await
if (env.isProduction) {
  import("@hono/node-server").then(({ serve }) => {
    import("./lib/vite").then(({ serveStaticFiles }) => {
      serveStaticFiles(app);
      const port = parseInt(process.env.PORT || "3000");
      serve({ fetch: app.fetch, port }, () => {
        console.log(`Server running on http://localhost:${port}/`);
      });
    });
  });
}
