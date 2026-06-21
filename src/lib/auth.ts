import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { env } from "@/env";

export const auth = betterAuth({
  baseURL: env.appUrl,
  secret: env.authSecret,
  // Accept requests whose Origin matches the configured public URL.
  trustedOrigins: [env.appUrl],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // No email infra in this project; let sign-ups in immediately.
    requireEmailVerification: false,
  },
  // Must be the last plugin so cookies are set on Next.js server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
