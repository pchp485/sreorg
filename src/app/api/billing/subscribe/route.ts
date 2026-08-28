import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSubscription, PLANS, type PlanCode } from "@/lib/razorpay";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  planCode: z.enum(["pro_monthly", "pro_yearly"]),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email and plan are required" }, { status: 400 });
  }
  const { email, planCode } = parsed.data;

  try {
    // Create the user up front so the webhook has something to attach to even
    // if the customer never returns to the site after paying.
    const [user] = await db
      .insert(schema.users)
      .values({ email })
      .onConflictDoUpdate({ target: schema.users.email, set: { email } })
      .returning({ id: schema.users.id });

    const subscription = await createSubscription({
      planCode: planCode as PlanCode,
      email,
      notes: { user_id: user.id, plan_code: planCode },
    });

    await db.insert(schema.subscriptions).values({
      userId: user.id,
      razorpaySubscriptionId: subscription.id,
      planCode,
      status: subscription.status,
      amountPaise: PLANS[planCode as PlanCode].amountPaise,
    }).onConflictDoNothing();

    await track({ name: "checkout_started", userId: user.id, meta: { planCode } });

    return NextResponse.json({ checkoutUrl: subscription.short_url });
  } catch (err) {
    console.error("[billing] subscribe failed", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
