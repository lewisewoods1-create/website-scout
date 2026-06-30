import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User, LocalUser } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { authenticateLocalRequest } from "./routers/local-auth";

export type UnifiedUser = {
  id: number;
  unionId?: string;
  email?: string | null;
  name?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  authType: "oauth" | "local";
};

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: UnifiedUser;
};

function unifyOAuthUser(user: User): UnifiedUser {
  return {
    id: user.id,
    unionId: user.unionId,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role as "user" | "admin",
    authType: "oauth",
  };
}

function unifyLocalUser(user: LocalUser): UnifiedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "user" | "admin",
    authType: "local",
  };
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try OAuth first
  try {
    const oauthUser = await authenticateRequest(opts.req.headers);
    if (oauthUser) {
      ctx.user = unifyOAuthUser(oauthUser);
      return ctx;
    }
  } catch {
    // OAuth auth failed, try local
  }

  // Try local auth
  try {
    const localUser = await authenticateLocalRequest(opts.req.headers);
    if (localUser) {
      ctx.user = unifyLocalUser(localUser);
      return ctx;
    }
  } catch {
    // Local auth failed
  }

  return ctx;
}
