import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Statuses in which Razorpay considers the customer to be paying us. */
export const PAYING_STATUSES = ["active", "authenticated", "pending"] as const;

export const FREE_LIMITS = { invoicesPerMonth: 3, clients: 2, autoReminders: false } as const;
export const PRO_LIMITS = { invoicesPerMonth: Infinity, clients: Infinity, autoReminders: true } as const;

export type Plan = "free" | "pro";

export async function getPlan(userId: string): Promise<Plan> {
  const [sub] = await db
    .select({ status: schema.subscriptions.status })
    .from(schema.subscriptions)
    .where(and(
      eq(schema.subscriptions.userId, userId),
      inArray(schema.subscriptions.status, [...PAYING_STATUSES]),
    ))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);

  return sub ? "pro" : "free";
}

export function limitsFor(plan: Plan) {
  return plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
}

/**
 * The free tier is deliberately usable — three invoices a month covers a
 * hobbyist forever. The paid trigger is *automation* (auto-chasing overdue
 * invoices), which is the thing that costs a freelancer real money to skip.
 */
export function requiresPro(action: "auto_reminders" | "unlimited_invoices" | "branding_removal"): boolean {
  return true;
}
