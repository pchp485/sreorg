/**
 * The instrument panel. Emails one number that matters (MRR against the ₹30,000
 * target) plus the pages that actually produced paying customers, so the next
 * decision is made from evidence instead of vibes.
 */
import { currentMrr, pageFunnel } from "../src/lib/analytics";
import { formatINR } from "../src/lib/money";
import { sendEmail, layout } from "../src/lib/email";
import { env } from "../src/lib/env";
import { PLANS } from "../src/lib/razorpay";

const TARGET_MRR_PAISE = 3_000_000; // ₹30,000/month

export async function buildReport() {
  const [mrr, funnel] = await Promise.all([currentMrr(), pageFunnel(30)]);

  const subsNeeded = Math.max(
    0,
    Math.ceil((TARGET_MRR_PAISE - mrr.mrrPaise) / PLANS.pro_monthly.amountPaise),
  );
  const pct = Math.round((mrr.mrrPaise / TARGET_MRR_PAISE) * 100);

  const winners = funnel.filter((r) => r.conversions > 0).slice(0, 10);
  const traffic = funnel.slice(0, 10);

  return { mrr, subsNeeded, pct, winners, traffic };
}

function table(rows: Array<{ path: string; views: number; signups: number; conversions: number }>): string {
  if (rows.length === 0) return "<p style='color:#666'>No data yet.</p>";
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><th align="left">Page</th><th align="right">Views</th><th align="right">Signups</th><th align="right">Paid</th></tr>
${rows.map((r) => `<tr>
<td style="border-top:1px solid #eee;padding:6px 0">${r.path}</td>
<td style="border-top:1px solid #eee;text-align:right">${r.views}</td>
<td style="border-top:1px solid #eee;text-align:right">${r.signups}</td>
<td style="border-top:1px solid #eee;text-align:right">${r.conversions}</td>
</tr>`).join("")}
</table>`;
}

async function main() {
  const { mrr, subsNeeded, pct, winners, traffic } = await buildReport();

  const html = layout(`<h2>${formatINR(mrr.mrrPaise)} MRR — ${pct}% of ₹30,000</h2>
<p>${mrr.activeSubs} active subscription${mrr.activeSubs === 1 ? "" : "s"}.
${subsNeeded > 0
  ? `<strong>${subsNeeded} more</strong> at ₹399 gets you to target.`
  : `Target met. Consider raising the price or adding a higher tier.`}</p>

<h3>Pages that produced paying customers (30d)</h3>
${table(winners)}
<p style="color:#666;font-size:13px">Write more pages like these. This list is what the growth engine reads.</p>

<h3>Highest traffic pages (30d)</h3>
${table(traffic)}
<p style="color:#666;font-size:13px">High views with zero conversions means the page ranks but the offer does not land — fix the call to action before writing anything new.</p>`);

  if (env.OPERATOR_EMAIL) {
    await sendEmail({ to: env.OPERATOR_EMAIL, subject: `MRR ${formatINR(mrr.mrrPaise)} — ${pct}% of target`, html });
  }
  console.log(`[kpi] MRR=${formatINR(mrr.mrrPaise)} subs=${mrr.activeSubs} needed=${subsNeeded}`);
}

if (process.argv[1]?.endsWith("kpi-report.ts")) {
  main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
