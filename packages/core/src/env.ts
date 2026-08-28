import { z } from "zod";

/**
 * Fail loudly at boot rather than at 2am inside a webhook handler.
 * Per-product plan ids are read dynamically (see razorpay.ts) so adding a
 * product does not mean editing this schema.
 */
const schema = z.object({
  APP_URL: z.string().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),

  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Notifications <onboarding@resend.dev>"),
  OPERATOR_EMAIL: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
});

export const env = schema.parse({
  APP_URL: process.env.APP_URL,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-only-secret-do-not-use-in-production!!",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://localhost:5432/sreorg",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  OPERATOR_EMAIL: process.env.OPERATOR_EMAIL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

/** Razorpay plan ids are looked up by name so the product registry stays the single source. */
export function readEnv(name: string): string {
  return process.env[name] ?? "";
}
