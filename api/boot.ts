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

// tRPC handler — POST requests need body forwarded properly
app.on(["GET", "POST"], "/api/trpc/*", async (c) => {
  const req = c.req.raw;
  
  // For POST requests, ensure body is readable by creating a new Request
  if (req.method === "POST") {
    const bodyText = await req.text();
    const newReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: bodyText,
    });
    
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: newReq,
      router: appRouter,
      createContext,
    });
  }
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
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
