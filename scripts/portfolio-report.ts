/**
 * The instrument panel for the whole portfolio, and the thing that stops it
 * becoming a graveyard.
 *
 * A portfolio only beats a single product if dead products actually get shut
 * down. Nobody kills their own project voluntarily, so the criteria are written
 * here, in advance, and the report applies them without sentiment.
 */
import {
  portfolioMetrics, pageFunnel, formatINR, sendEmail, layout, env,
  PRODUCTS, type ProductId, type ProductMetrics,
} from "@sreorg/core";

const TARGET_MRR_PAISE = 3_000_000; // Rs 30,000/month

export type Verdict = "SCALE" | "FIX" | "HOLD" | "KILL";

export interface Assessment {
  metrics: ProductMetrics;
  verdict: Verdict;
  reason: string;
  /** Subscribers still needed for this product alone to carry the target. */
  subsToTarget: number;
}

/** Thresholds, fixed in advance so they cannot be argued with later. */
const RULES = {
  /** Below this age nothing is judged — SEO has not had time to land. */
  gracePeriodDays: 90,
  /** By this age a product with nothing to show is finished. */
  verdictDays: 180,
  killMrrPaise: 200_000,          // Rs 2,000
  /** Traffic this high with zero conversions means the offer is wrong. */
  fixViewsThreshold: 500,
  /** Monthly churn above this eats any acquisition you manage. */
  churnAlarmPercent: 10,
} as const;

export function assess(m: ProductMetrics): Assessment {
  const plan = PRODUCTS[m.product].plans[0];
  const subsToTarget = Math.max(0, Math.ceil((TARGET_MRR_PAISE - m.mrrPaise) / plan.amountPaise));
  const verdict = (): { verdict: Verdict; reason: string } => {
    if (m.ageDays < RULES.gracePeriodDays) {
      return {
        verdict: "HOLD",
        reason: `Only ${m.ageDays} days old. Nothing is judged before ${RULES.gracePeriodDays} days — search rankings have not had time to land.`,
      };
    }

    if (m.ageDays >= RULES.verdictDays && m.mrrPaise < RULES.killMrrPaise && m.newSubs30d === 0) {
      return {
        verdict: "KILL",
        reason: `${m.ageDays} days old, ${formatINR(m.mrrPaise)} MRR, no new subscribers in 30 days. Shut it down and put the hours into whatever is working.`,
      };
    }

    if (m.churnPercent > RULES.churnAlarmPercent && m.activeSubs > 0) {
      return {
        verdict: "FIX",
        reason: `${m.churnPercent}% monthly churn. Customers are leaving faster than the funnel can replace them — fix retention before spending anything on acquisition.`,
      };
    }

    if (m.views30d >= RULES.fixViewsThreshold && m.activeSubs === 0) {
      return {
        verdict: "FIX",
        reason: `${m.views30d} views and no paying customers. The traffic works and the offer does not. Change the call to action before writing another page.`,
      };
    }

    if (m.newSubs30d > 0) {
      return {
        verdict: "SCALE",
        reason: `${m.newSubs30d} new subscriber${m.newSubs30d === 1 ? "" : "s"} in 30 days at ${m.churnPercent}% churn. This one is working — put the content effort here.`,
      };
    }

    return {
      verdict: "FIX",
      reason: `${m.views30d} views, ${m.signups30d} signups, no new subscribers this month. Something between the page and the payment is broken.`,
    };
  };

  return { metrics: m, ...verdict(), subsToTarget };
}

export interface PortfolioReport {
  assessments: Assessment[];
  totalMrrPaise: number;
  totalSubs: number;
  percentOfTarget: number;
  /** The one product to spend this month on. Spreading effort is how portfolios die. */
  focus: ProductId | null;
  focusReason: string;
}

export async function buildPortfolioReport(): Promise<PortfolioReport> {
  const metrics = await portfolioMetrics();
  const assessments = metrics.map(assess);

  const totalMrrPaise = metrics.reduce((sum, m) => sum + m.mrrPaise, 0);
  const totalSubs = metrics.reduce((sum, m) => sum + m.activeSubs, 0);

  // Focus goes to the product already converting; only if none is, to the one
  // closest to converting. One person cannot push three products at once.
  const scaling = assessments.filter((a) => a.verdict === "SCALE")
    .sort((a, b) => b.metrics.newSubs30d - a.metrics.newSubs30d);
  const fixing = assessments.filter((a) => a.verdict === "FIX")
    .sort((a, b) => b.metrics.views30d - a.metrics.views30d);

  let focus: ProductId | null = null;
  let focusReason = "Nothing has enough data yet. Keep all three running and do not add a fourth.";

  if (scaling.length > 0) {
    focus = scaling[0].metrics.product;
    focusReason = `${PRODUCTS[focus].name} is the only one converting. Every hour this month goes here; the others just keep running.`;
  } else if (fixing.length > 0) {
    focus = fixing[0].metrics.product;
    focusReason = `Nothing is converting yet. ${PRODUCTS[focus].name} has the most traffic, so it is the cheapest place to find out why.`;
  }

  return {
    assessments,
    totalMrrPaise,
    totalSubs,
    percentOfTarget: Math.round((totalMrrPaise / TARGET_MRR_PAISE) * 100),
    focus,
    focusReason,
  };
}

const BADGE: Record<Verdict, string> = {
  SCALE: "#0a7a4b", FIX: "#b26a00", HOLD: "#5b6572", KILL: "#c0392b",
};

function renderHtml(report: PortfolioReport, funnel: Awaited<ReturnType<typeof pageFunnel>>): string {
  const rows = report.assessments.map((a) => `<tr>
  <td style="padding:8px 0;border-top:1px solid #eee">
    <strong>${a.metrics.product}</strong><br/>
    <span style="color:${BADGE[a.verdict]};font-weight:600;font-size:13px">${a.verdict}</span>
  </td>
  <td style="padding:8px 0;border-top:1px solid #eee;text-align:right">${formatINR(a.metrics.mrrPaise)}</td>
  <td style="padding:8px 0;border-top:1px solid #eee;text-align:right">${a.metrics.activeSubs}</td>
  <td style="padding:8px 0;border-top:1px solid #eee;text-align:right">${a.metrics.views30d}</td>
  <td style="padding:8px 0;border-top:1px solid #eee;color:#666;font-size:13px">${a.reason}</td>
</tr>`).join("");

  const winners = funnel.filter((r) => r.conversions > 0).slice(0, 10);
  const winnerRows = winners.length === 0
    ? `<p style="color:#666">No page has produced a paying customer yet.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:14px">
${winners.map((r) => `<tr>
  <td style="border-top:1px solid #eee;padding:6px 0">${r.product}${r.path}</td>
  <td style="border-top:1px solid #eee;text-align:right">${r.views}</td>
  <td style="border-top:1px solid #eee;text-align:right">${r.conversions}</td>
</tr>`).join("")}</table>`;

  return layout(`<h2>${formatINR(report.totalMrrPaise)} MRR — ${report.percentOfTarget}% of ₹30,000</h2>
<p>${report.totalSubs} active subscription${report.totalSubs === 1 ? "" : "s"} across ${report.assessments.length} products.</p>

<h3 style="margin-top:24px">This month, work on one thing</h3>
<p style="background:#f5f8ff;border-left:3px solid #0b5fff;padding:10px 14px;margin:0">
  ${report.focusReason}
</p>

<h3 style="margin-top:24px">Per product</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><th align="left">Product</th><th align="right">MRR</th><th align="right">Subs</th><th align="right">Views</th><th align="left">Verdict</th></tr>
${rows}
</table>

<h3 style="margin-top:24px">Pages that produced paying customers (30d)</h3>
${winnerRows}

<p style="color:#666;font-size:13px;margin-top:24px">
Verdicts come from fixed thresholds, not judgement: KILL means over ${RULES.verdictDays} days
old, under ${formatINR(RULES.killMrrPaise)} MRR and no new subscribers in a month. If a product
reads KILL, shut it down this week — the thresholds were set before you were attached to it.
</p>`);
}

async function main() {
  const [report, funnel] = await Promise.all([buildPortfolioReport(), pageFunnel(30)]);

  if (env.OPERATOR_EMAIL) {
    await sendEmail({
      to: env.OPERATOR_EMAIL,
      subject: `${formatINR(report.totalMrrPaise)} MRR — ${report.percentOfTarget}% of target`,
      html: renderHtml(report, funnel),
    });
  }

  console.log(`[portfolio] MRR=${formatINR(report.totalMrrPaise)} subs=${report.totalSubs} focus=${report.focus ?? "none"}`);
  for (const a of report.assessments) {
    console.log(`  ${a.metrics.product.padEnd(12)} ${a.verdict.padEnd(6)} ${formatINR(a.metrics.mrrPaise)} — ${a.reason}`);
  }
}

if (process.argv[1]?.endsWith("portfolio-report.ts")) {
  main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
