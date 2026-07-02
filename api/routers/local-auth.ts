import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import * as cookieLib from "cookie";

const JWT_ALG = "HS256";

async function signLocalToken(payload: { userId: number; email: string }): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret + "_local");
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifyLocalToken(token: string): Promise<{ userId: number; email: string } | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(env.appSecret + "_local");
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: [JWT_ALG], clockTolerance: 60 });
    return payload as unknown as { userId: number; email: string };
  } catch {
    return null;
  }
}

export async function authenticateLocalRequest(headers: Headers) {
  const cookies = cookieLib.parse(headers.get("cookie") || "");
  const token = cookies[Session.localCookieName];
  if (!token) return null;
  const claim = await verifyLocalToken(token);
  if (!claim) return null;
  const db = getDb();
  const rows = await db.select().from(schema.localUsers).where(eq(schema.localUsers.id, claim.userId)).limit(1);
  return rows.at(0) ?? null;
}

function generateToken(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.localUsers)
        .where(eq(schema.localUsers.email, input.email))
        .limit(1);
      if (existing.length > 0) {
        return { success: false, error: "Email already registered" };
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const confirmationToken = generateToken();

      await db.insert(schema.localUsers).values({
        email: input.email,
        passwordHash,
        name: input.name || input.email.split("@")[0],
        confirmationToken,
        role: "user",
        emailConfirmed: true,
      });

      return { success: true, message: "Account created! You can now log in." };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.localUsers)
        .where(eq(schema.localUsers.email, input.email))
        .limit(1);
      const user = rows.at(0);
      if (!user) {
        return { success: false, error: "Invalid email or password" };
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        return { success: false, error: "Invalid email or password" };
      }

      await db
        .update(schema.localUsers)
        .set({ lastSignInAt: new Date() })
        .where(eq(schema.localUsers.id, user.id));

      const token = await signLocalToken({ userId: user.id, email: user.email });

      const cookieOpts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookieLib.serialize(Session.localCookieName, token, {
          httpOnly: cookieOpts.httpOnly ?? true,
          path: cookieOpts.path ?? "/",
          sameSite: (cookieOpts.sameSite?.toLowerCase() as "lax" | "none" | "strict") ?? "lax",
          secure: cookieOpts.secure ?? false,
          maxAge: Session.maxAgeMs / 1000,
        })
      );

      return {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    }),

  confirmEmail: publicQuery
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.localUsers)
        .where(eq(schema.localUsers.confirmationToken, input.token))
        .limit(1);
      const user = rows.at(0);
      if (!user) {
        return { success: false, error: "Invalid confirmation token" };
      }

      await db
        .update(schema.localUsers)
        .set({ emailConfirmed: 1, confirmationToken: null })
        .where(eq(schema.localUsers.id, user.id));

      return { success: true, message: "Email confirmed! You can now log in." };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const cookies = cookieLib.parse(ctx.req.headers.get("cookie") || "");
    const token = cookies[Session.localCookieName];
    if (!token) return null;
    const claim = await verifyLocalToken(token);
    if (!claim) return null;
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.localUsers)
      .where(eq(schema.localUsers.id, claim.userId))
      .limit(1);
    const user = rows.at(0);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailConfirmed: user.emailConfirmed,
      createdAt: user.createdAt,
    };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookieLib.serialize(Session.localCookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      })
    );
    return { success: true };
  }),

  requestPasswordReset: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.localUsers)
        .where(eq(schema.localUsers.email, input.email))
        .limit(1);
      const user = rows.at(0);
      if (!user) {
        return { success: true, message: "If the email exists, a reset link has been sent." };
      }

      const resetToken = generateToken();
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(schema.localUsers)
        .set({ resetToken, resetTokenExpiry })
        .where(eq(schema.localUsers.id, user.id));

      return { success: true, message: "If the email exists, a reset link has been sent." };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        token: z.string(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.localUsers)
        .where(eq(schema.localUsers.resetToken, input.token))
        .limit(1);
      const user = rows.at(0);
      if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
        return { success: false, error: "Invalid or expired reset token" };
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      await db
        .update(schema.localUsers)
        .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
        .where(eq(schema.localUsers.id, user.id));

      return { success: true, message: "Password reset successfully" };
    }),
});
