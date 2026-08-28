import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const API = "https://api.razorpay.com/v1";

function authHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Verifies the `x-razorpay-signature` header against the RAW request body.
 * The body must be the exact bytes Razorpay sent — re-serialising parsed JSON
 * changes key order and whitespace and the HMAC will never match.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = env.RAZORPAY_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const PLANS = {
  pro_monthly: { code: "pro_monthly", label: "Pro — monthly", amountPaise: 39900, period: "monthly" },
  pro_yearly: { code: "pro_yearly", label: "Pro — yearly", amountPaise: 399000, period: "yearly" },
} as const;

export type PlanCode = keyof typeof PLANS;

export function razorpayPlanId(code: PlanCode): string {
  return code === "pro_monthly" ? env.RAZORPAY_PLAN_ID_PRO_MONTHLY : env.RAZORPAY_PLAN_ID_PRO_YEARLY;
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
 * Creates a subscription and returns Razorpay's hosted checkout URL. Using the
 * hosted page keeps card data entirely out of this system — no PCI scope.
 */
export async function createSubscription(args: {
  planCode: PlanCode;
  email: string;
  totalCount?: number;
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  const planId = razorpayPlanId(args.planCode);
  if (!planId) throw new Error(`No Razorpay plan configured for ${args.planCode}`);

  return call<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      // 120 monthly cycles ~ 10 years; Razorpay requires a finite count.
      total_count: args.totalCount ?? (args.planCode === "pro_monthly" ? 120 : 10),
      customer_notify: 1,
      notify_info: { notify_email: args.email },
      notes: { email: args.email, ...args.notes },
    }),
  });
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
