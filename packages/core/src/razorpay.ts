import { createHmac, timingSafeEqual } from "node:crypto";
import { env, readEnv } from "./env";
import { findPlan, monthlyEquivalentPaise, type PlanDef } from "./products";

const API = "https://api.razorpay.com/v1";

function authHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Verifies `x-razorpay-signature` against the RAW request body. The body must be
 * the exact bytes Razorpay sent — re-serialising parsed JSON changes key order
 * and whitespace, and the HMAC will never match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret = env.RAZORPAY_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function razorpayPlanId(plan: PlanDef): string {
  return readEnv(plan.planIdEnv);
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: authHeader(), ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Razorpay ${path} failed (${res.status}): ${body}`);
  return JSON.parse(body) as T;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  customer_id?: string;
  short_url: string;
  current_end?: number | null;
}

/**
 * One subscription flow for every product in the portfolio. The hosted checkout
 * keeps card data entirely out of this system, so nothing here is in PCI scope.
 */
export async function createSubscription(args: {
  planCode: string;
  email: string;
  notes?: Record<string, string>;
}): Promise<{ subscription: RazorpaySubscription; plan: PlanDef; mrrPaise: number }> {
  const found = findPlan(args.planCode);
  if (!found) throw new Error(`Unknown plan "${args.planCode}"`);

  const planId = razorpayPlanId(found.plan);
  if (!planId) throw new Error(`${found.plan.planIdEnv} is not set`);

  const subscription = await call<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      // Razorpay requires a finite count: 120 monthly cycles or 10 yearly ones.
      total_count: found.plan.period === "monthly" ? 120 : 10,
      customer_notify: 1,
      notify_info: { notify_email: args.email },
      notes: { email: args.email, plan_code: args.planCode, product: found.product.id, ...args.notes },
    }),
  });

  return { subscription, plan: found.plan, mrrPaise: monthlyEquivalentPaise(found.plan) };
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(`/subscriptions/${id}`, { method: "GET" });
}

export async function cancelSubscription(id: string, atCycleEnd = true): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(`/subscriptions/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

/** Razorpay's event name is more reliable than the entity status on some events. */
export function subscriptionStatusFor(event: string, entityStatus: string): string {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "active";
    case "subscription.halted": return "halted";
    case "subscription.cancelled": return "cancelled";
    case "subscription.completed": return "completed";
    case "subscription.pending": return "pending";
    case "subscription.paused": return "paused";
    default: return entityStatus || "created";
  }
}
