import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import type { ProductId } from "./products";

/** Statuses in which Razorpay considers the customer to be paying us. */
export const PAYING_STATUSES = ["active", "authenticated", "pending"] as const;

export type Plan = "free" | "paid";

/**
 * Entitlement is always product-scoped: paying for payroll must not unlock
 * invoicing. Reads the local cache, never Razorpay — a rate limit on their API
 * must never become "your subscription expired" for a paying customer.
 */
export async function getPlan(userId: string, product: ProductId): Promise<Plan> {
  const [sub] = await db
    .select({ status: schema.subscriptions.status })
    .from(schema.subscriptions)
    .where(and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.product, product),
      inArray(schema.subscriptions.status, [...PAYING_STATUSES]),
    ))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);

  return sub ? "paid" : "free";
}

/** Every product's free tier is usable; what you buy is the automation. */
export const FREE_LIMITS: Record<ProductId, Record<string, number | boolean>> = {
  invoicing: { invoicesPerMonth: 3, clients: 2, autoReminders: false },
  payroll: { employees: 2, autoPayslips: false },
  compliance: { obligationsTracked: Infinity, autoReminders: false },
};

export async function payingUserIds(product: ProductId): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: schema.subscriptions.userId })
    .from(schema.subscriptions)
    .where(and(
      eq(schema.subscriptions.product, product),
      inArray(schema.subscriptions.status, [...PAYING_STATUSES]),
    ));
  return rows.map((r) => r.userId);
}
