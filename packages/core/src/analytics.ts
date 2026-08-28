import { sql } from "drizzle-orm";
import { db, schema } from "./db";
import { PRODUCTS, type ProductId } from "./products";

export type EventName =
  | "page_view" | "tool_used" | "signup"
  | "checkout_started" | "subscription_active" | "subscription_cancelled"
  | "automation_ran";

/** Cookie-free, PII-free. A path and a referrer host, nothing else. */
export async function track(args: {
  product: ProductId;
  name: EventName;
  path?: string;
  referrer?: string;
  userId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schema.events).values({
      product: args.product,
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
  try { return new URL(referrer).host; } catch { return null; }
}

export interface FunnelRow {
  product: string;
  path: string;
  views: number;
  signups: number;
  conversions: number;
}

/** Which landing pages produce paying customers. The growth engine reads this. */
export async function pageFunnel(days = 30, product?: ProductId): Promise<FunnelRow[]> {
  const rows = await db.execute(sql`
    SELECT
      product,
      path,
      COUNT(*) FILTER (WHERE name = 'page_view')           AS views,
      COUNT(*) FILTER (WHERE name = 'signup')              AS signups,
      COUNT(*) FILTER (WHERE name = 'subscription_active') AS conversions
    FROM events
    WHERE created_at > NOW() - (${days} || ' days')::interval
      AND path IS NOT NULL
      ${product ? sql`AND product = ${product}` : sql``}
    GROUP BY product, path
    ORDER BY conversions DESC, views DESC
    LIMIT 100
  `);
  return rowsOf(rows).map((r) => ({
    product: String(r.product),
    path: String(r.path),
    views: Number(r.views ?? 0),
    signups: Number(r.signups ?? 0),
    conversions: Number(r.conversions ?? 0),
  }));
}

export interface ProductMetrics {
  product: ProductId;
  activeSubs: number;
  mrrPaise: number;
  views30d: number;
  signups30d: number;
  newSubs30d: number;
  cancelled30d: number;
  /** Monthly churn as a percentage of the active base. */
  churnPercent: number;
  ageDays: number;
}

/**
 * One query for the whole portfolio. Adding a product must not mean adding a
 * dashboard — if the numbers are not comparable side by side, the kill decision
 * never gets made.
 */
export async function portfolioMetrics(): Promise<ProductMetrics[]> {
  const rows = await db.execute(sql`
    WITH subs AS (
      SELECT
        product,
        COUNT(*) FILTER (WHERE status IN ('active','authenticated'))                   AS active_subs,
        COALESCE(SUM(mrr_paise) FILTER (WHERE status IN ('active','authenticated')),0) AS mrr,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')                AS new_subs,
        COUNT(*) FILTER (WHERE cancelled_at > NOW() - INTERVAL '30 days')              AS cancelled
      FROM subscriptions GROUP BY product
    ),
    ev AS (
      SELECT
        product,
        COUNT(*) FILTER (WHERE name = 'page_view' AND created_at > NOW() - INTERVAL '30 days') AS views,
        COUNT(*) FILTER (WHERE name = 'signup'    AND created_at > NOW() - INTERVAL '30 days') AS signups,
        MIN(created_at) AS first_seen
      FROM events GROUP BY product
    )
    SELECT
      COALESCE(subs.product, ev.product) AS product,
      COALESCE(active_subs,0)::int AS active_subs,
      COALESCE(mrr,0)::int         AS mrr,
      COALESCE(views,0)::int       AS views,
      COALESCE(signups,0)::int     AS signups,
      COALESCE(new_subs,0)::int    AS new_subs,
      COALESCE(cancelled,0)::int   AS cancelled,
      ev.first_seen
    FROM subs FULL OUTER JOIN ev ON subs.product = ev.product
  `);

  const byProduct = new Map<string, Record<string, unknown>>();
  for (const r of rowsOf(rows)) byProduct.set(String(r.product), r);

  return (Object.keys(PRODUCTS) as ProductId[]).map((id) => {
    const r = byProduct.get(id) ?? {};
    const activeSubs = Number(r.active_subs ?? 0);
    const cancelled = Number(r.cancelled ?? 0);
    const firstSeen = r.first_seen ? new Date(String(r.first_seen)) : null;

    return {
      product: id,
      activeSubs,
      mrrPaise: Number(r.mrr ?? 0),
      views30d: Number(r.views ?? 0),
      signups30d: Number(r.signups ?? 0),
      newSubs30d: Number(r.new_subs ?? 0),
      cancelled30d: cancelled,
      churnPercent: activeSubs + cancelled > 0
        ? Math.round((cancelled / (activeSubs + cancelled)) * 1000) / 10
        : 0,
      ageDays: firstSeen ? Math.floor((Date.now() - firstSeen.getTime()) / 86_400_000) : 0,
    };
  });
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return result as Array<Record<string, unknown>>;
}
