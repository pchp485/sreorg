import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";
import { track, type EventName } from "./analytics";
import { sendEmail, layout } from "./email";
import { createSubscription, verifyWebhookSignature, subscriptionStatusFor } from "./razorpay";
import { findPlan, PRODUCTS, type ProductId } from "./products";

/**
 * Shared HTTP handlers. Every product mounts these rather than reimplementing
 * them — three copies of a payment webhook is three places for an entitlement
 * bug to hide.
 */

export async function handleSubscribe(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { email?: string; planCode?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const planCode = body?.planCode;

  if (!email || !email.includes("@") || !planCode || !findPlan(planCode)) {
    return json({ error: "A valid email and plan are required" }, 400);
  }
  const { product } = findPlan(planCode)!;

  try {
    // Create the user up front so the webhook has something to attach to even if
    // the customer never returns to the site after paying.
    const [user] = await db
      .insert(schema.users)
      .values({ email, acquisitionProduct: product.id })
      .onConflictDoUpdate({ target: schema.users.email, set: { email } })
      .returning({ id: schema.users.id });

    const { subscription, plan, mrrPaise } = await createSubscription({
      planCode,
      email,
      notes: { user_id: user.id },
    });

    await db.insert(schema.subscriptions).values({
      userId: user.id,
      product: product.id,
      razorpaySubscriptionId: subscription.id,
      planCode: plan.code,
      status: subscription.status,
      amountPaise: plan.amountPaise,
      mrrPaise,
    }).onConflictDoNothing();

    await track({ product: product.id, name: "checkout_started", userId: user.id, meta: { planCode } });

    return json({ checkoutUrl: subscription.short_url });
  } catch (err) {
    console.error("[billing] subscribe failed", err);
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }
}

/**
 * The only writer of entitlement state, for every product.
 *
 * Three properties it must hold:
 *   1. Signature-verified against the RAW body, or rejected.
 *   2. Idempotent — Razorpay retries for up to 24 hours.
 *   3. Always 200 on a handled event, so Razorpay stops retrying.
 */
export async function handleRazorpayWebhook(request: Request): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[webhook] rejected: bad signature");
    return json({ error: "invalid signature" }, 400);
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid json" }, 400); }

  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  if (eventId) {
    const inserted = await db
      .insert(schema.webhookEvents)
      .values({ id: eventId, event: body.event ?? "unknown", payload: body })
      .onConflictDoNothing()
      .returning({ id: schema.webhookEvents.id });

    if (inserted.length === 0) return json({ ok: true, deduped: true });
  }

  try {
    await applySubscriptionEvent(body);
  } catch (err) {
    // Log loudly but still 200: the event is stored in webhook_events and can be
    // replayed. A 500 makes Razorpay retry an event we already recorded, which
    // then dedupes into a silent no-op.
    console.error(`[webhook] handler failed for ${body.event}`, err);
  }

  return json({ ok: true });
}

async function applySubscriptionEvent(body: any): Promise<void> {
  const entity = body.payload?.subscription?.entity;
  if (!entity) return;

  const event: string = body.event ?? "";
  const status = subscriptionStatusFor(event, entity.status);
  const cancelling = ["cancelled", "completed", "halted"].includes(status);

  const [row] = await db
    .update(schema.subscriptions)
    .set({
      status,
      razorpayCustomerId: entity.customer_id ?? null,
      currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000) : null,
      updatedAt: new Date(),
      ...(cancelling ? { cancelledAt: new Date() } : {}),
    })
    .where(eq(schema.subscriptions.razorpaySubscriptionId, entity.id))
    .returning({ userId: schema.subscriptions.userId, product: schema.subscriptions.product });

  if (!row) {
    console.warn(`[webhook] no local subscription for ${entity.id}`);
    return;
  }

  const product = row.product as ProductId;

  if (event === "subscription.activated" || event === "subscription.charged") {
    await track({ product, name: "subscription_active", userId: row.userId, meta: { event } });
  }
  if (cancelling) {
    await track({ product, name: "subscription_cancelled", userId: row.userId, meta: { event } });
  }

  if (event === "subscription.activated") {
    const [user] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, row.userId));

    if (user) {
      await sendEmail({
        to: user.email,
        subject: `You're subscribed — ${PRODUCTS[product].name}`,
        html: layout(`<h2>Welcome aboard</h2>
<p>${PRODUCTS[product].promise}</p>
<p>It starts on the next scheduled run. Nothing else for you to do.</p>`),
      });
    }
    if (env.OPERATOR_EMAIL) {
      await sendEmail({
        to: env.OPERATOR_EMAIL,
        subject: `New paying customer — ${product}`,
        html: layout(`<p>Subscription <code>${entity.id}</code> activated on <strong>${product}</strong>.</p>`),
      });
    }
  }
}

/** Deliberately narrow: only anonymous top-of-funnel events come from the browser. */
export async function handleTrack(request: Request, product: ProductId): Promise<Response> {
  const body = await request.json().catch(() => null) as { name?: string; path?: string; referrer?: string } | null;
  if (body?.name !== "page_view" && body?.name !== "tool_used") return json({ ok: false }, 400);

  await track({ product, name: body.name as EventName, path: body.path, referrer: body.referrer });
  return json({ ok: true });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
