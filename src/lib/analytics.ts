import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type EventName =
  | "page_view" | "tool_used" | "signup"
  | "checkout_started" | "subscription_active" | "invoice_sent" | "reminder_sent";

/** Cookie-free, PII-free. We store a path and a referrer host, nothing else. */
export async function track(args: {
  name: EventName;
  path?: string;
  referrer?: string;
  userId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schema.events).values({
      name: args.name,
      path: args.path?.slice(0, 512),
      referrer: args.referrer ? safeHost(args.referrer) : null,
      userId: args.userId ?? null,
      meta: args.meta ?? null,
    });
  } catch (err) {
    // Analytics must never break a user-facing request.
    console.error("[analytics] insert failed", err);
  }
}

function safeHost(referrer: string): string | null {
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}

export interface FunnelRow {
  path: string;
  views: number;
  signups: number;
  conversions: number;
}

/**
 * Which landing pages actually produce paying customers. The growth engine
 * reads this to decide what to write more of — the loop that makes the
 * content machine get better instead of just bigger.
 */
export async function pageFunnel(days = 30): Promise<FunnelRow[]> {
  const rows = await db.execute(sql`
    SELECT
      path,
      COUNT(*) FILTER (WHERE name = 'page_view')            AS views,
      COUNT(*) FILTER (WHERE name = 'signup')               AS signups,
      COUNT(*) FILTER (WHERE name = 'subscription_active')  AS conversions
    FROM events
    WHERE created_at > NOW() - (${days} || ' days')::interval
      AND path IS NOT NULL
    GROUP BY path
    HAVING COUNT(*) FILTER (WHERE name = 'page_view') > 0
    ORDER BY conversions DESC, views DESC
    LIMIT 50
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    path: String(r.path),
    views: Number(r.views ?? 0),
    signups: Number(r.signups ?? 0),
    conversions: Number(r.conversions ?? 0),
  }));
}

export interface Mrr { activeSubs: number; mrrPaise: number; }

export async function currentMrr(): Promise<Mrr> {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS subs,
      COALESCE(SUM(
        CASE WHEN plan_code = 'pro_yearly' THEN amount_paise / 12 ELSE amount_paise END
      ), 0)::int AS mrr
    FROM subscriptions
    WHERE status IN ('active', 'authenticated')
  `);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  return { activeSubs: Number(row.subs ?? 0), mrrPaise: Number(row.mrr ?? 0) };
}
