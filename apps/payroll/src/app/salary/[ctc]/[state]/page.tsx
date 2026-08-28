import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSalaryPage, CTC_BRACKETS, STATES, lakhsLabel } from "../../../../content/pseo";
import { buildPayslip, professionalTax } from "@sreorg/tax-india";
import { formatINR, rupeesToPaise } from "@sreorg/core";
import SalaryCalculator from "../../../../components/SalaryCalculator";

type Params = Promise<{ ctc: string; state: string }>;

/** Prerender the busiest combinations only; the rest render on demand and cache. */
export function generateStaticParams() {
  const topStates = ["karnataka", "maharashtra", "delhi", "tamil-nadu", "telangana"];
  return [1_000_000, 1_200_000, 1_500_000, 2_000_000].flatMap((ctc) =>
    topStates.map((state) => ({ ctc: String(ctc), state })));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ctc, state } = await params;
  const page = buildSalaryPage(ctc, state);
  if (!page) return {};
  return { title: page.title, description: page.description, alternates: { canonical: `/salary/${page.slug}` } };
}

export default async function SalaryPseoPage({ params }: { params: Params }) {
  const { ctc, state } = await params;
  const page = buildSalaryPage(ctc, state);
  if (!page) notFound();

  const slip = buildPayslip({
    ctcPaise: Math.round(rupeesToPaise(page.annualCtc) / 12),
    stateCode: page.state.code,
  });
  const pt = professionalTax(page.state.code, slip.earnings.grossPaise);

  return (
    <>
      <h1>{page.title}</h1>
      <p className="lede">{page.description}</p>

      <div className="scroll">
        <table>
          <tbody>
            <tr><td>Annual CTC</td><td className="num">{formatINR(rupeesToPaise(page.annualCtc))}</td></tr>
            <tr><td>Monthly gross</td><td className="num">{formatINR(slip.earnings.grossPaise)}</td></tr>
            <tr><td>PF (employee)</td><td className="num">−{formatINR(slip.deductions.epfEmployee)}</td></tr>
            {slip.deductions.esiEmployee > 0 && (
              <tr><td>ESI (employee)</td><td className="num">−{formatINR(slip.deductions.esiEmployee)}</td></tr>
            )}
            <tr><td>{page.state.name} professional tax</td>
              <td className="num">−{formatINR(slip.deductions.professionalTax)}</td></tr>
            <tr><td>TDS (new regime)</td><td className="num">−{formatINR(slip.deductions.tds)}</td></tr>
            <tr><td><strong>In hand, per month</strong></td>
              <td className="num"><strong>{formatINR(slip.netPayPaise)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Where the rest of the money goes</h2>
      <p>
        Your employer also pays {formatINR(slip.employerCost.epfEmployer)} into provident fund
        and sets aside {formatINR(slip.employerCost.gratuity)} for gratuity every month. Both
        sit inside the {lakhsLabel(page.annualCtc)} figure and never appear in your gross
        salary, which is why CTC and take-home look so far apart.
      </p>

      <h2>Professional tax in {page.state.name}</h2>
      <p>
        {pt.configured
          ? pt.amountPaise > 0
            ? `${page.state.name} levies professional tax of ${formatINR(pt.amountPaise)} per month at this salary. It is deducted by the employer and paid to the state.`
            : `${page.state.name} does not levy professional tax at this salary level.`
          : `Professional tax slabs for ${page.state.name} are not configured here, so the figure above assumes zero. Verify against the state notification before relying on it.`}
      </p>

      <h2>Change the assumptions</h2>
      <SalaryCalculator defaultAnnualCtc={page.annualCtc} defaultState={page.state.code} />

      <div className="card" style={{ marginTop: 24 }}>
        <strong>Paying people, not just curious?</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          Pro emails every employee&apos;s payslip on the 1st with all of this computed. ₹499/month.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>

      <h2>Other packages in {page.state.name}</h2>
      <ul style={{ columns: 2 }}>
        {CTC_BRACKETS.filter((c) => c !== page.annualCtc).map((c) => (
          <li key={c}><Link href={`/salary/${c}/${page.state.slug}`}>{lakhsLabel(c)}</Link></li>
        ))}
      </ul>

      <h2>{lakhsLabel(page.annualCtc)} in other states</h2>
      <ul style={{ columns: 2 }}>
        {STATES.filter((s) => s.slug !== page.state.slug).slice(0, 16).map((s) => (
          <li key={s.slug}><Link href={`/salary/${page.annualCtc}/${s.slug}`}>{s.name}</Link></li>
        ))}
      </ul>
    </>
  );
}
