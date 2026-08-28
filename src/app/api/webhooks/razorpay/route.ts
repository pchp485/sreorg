import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { track } from "@/lib/analytics";
import { sendEmail, layout } from "@/lib/email";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only writer of entitlement state. Razorpay is the source of truth for
 * whether money actually arrived; nothing else in this system may grant Pro.
 *
 * Three properties this handler must hold:
 *   1. Signature-verified against the RAW body, or rejected.
 *   2. Idempotent — Razorpay retries for up to 24 hours.
 *   3. Always 200 on a *handled* event, so Razorpay stops retrying.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[webhook] rejected: bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Idempotency gate: if we have seen this event id, acknowledge and stop.
  if (eventId) {
    const inserted = await db
      .insert(schema.webhookEvents)
      .values({ id: eventId, event: body.event ?? "unknown", payload: body })
      .onConflictDoNothing()
      .returning({ id: schema.webhookEvents.id });

    if (inserted.length === 0) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  try {
    await handle(body);
  } catch (err) {
    // Log loudly but still 200: the event is recorded in webhook_events and can
    // be replayed by an operator. Returning 500 makes Razorpay retry an event
    // we have already stored, which would then dedupe into a silent no-op.
    console.error(`[webhook] handler failed for ${body.event}`, err);
  }

  return NextResponse.json({ ok: true });
}

async function handle(body: any): Promise<void> {
  const event: string = body.event ?? "";
  const subscription = body.payload?.subscription?.entity;
  if (!subscription) return;

  const status = subscriptionStatusFor(event, subscription.status);
  const currentEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : null;

  const [row] = await db
    .update(schema.subscriptions)
    .set({
      status,
      razorpayCustomerId: subscription.customer_id ?? null,
      currentPeriodEnd: currentEnd,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.razorpaySubscriptionId, subscription.id))
    .returning({ userId: schema.subscriptions.userId });

  if (!row) {
    console.warn(`[webhook] no local subscription for ${subscription.id}`);
    return;
  }

  if (event === "subscription.activated" || event === "subscription.charged") {
    await track({ name: "subscription_active", userId: row.userId, meta: { event } });
  }

  if (event === "subscription.activated") {
    const [user] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, row.userId));

    if (user) {
      await sendEmail({
        to: user.email,
        subject: "You're on Pro — your invoices now chase themselves",
        html: layout(`<h2>Welcome aboard</h2>
<p>Automatic reminders are live. Every invoice you mark as sent will now be followed up on
day 3, 7, 14 and 30 past its due date until it is paid.</p>
<p><a href="${env.APP_URL}/app">Open your dashboard</a></p>`),
      });
    }

    if (env.OPERATOR_EMAIL) {
      await sendEmail({
        to: env.OPERATOR_EMAIL,
        subject: "New paying customer",
        html: layout(`<p>Subscription <code>${subscription.id}</code> just activated.</p>`),
      });
    }
  }
}

/** Razorpay's event name is more reliable than the entity status on some events. */
function subscriptionStatusFor(event: string, entityStatus: string): string {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "active";
    case "subscription.halted":
      return "halted";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.completed":
      return "completed";
    case "subscription.pending":
      return "pending";
    case "subscription.paused":
      return "paused";
    default:
      return entityStatus ?? "created";
  }
}
