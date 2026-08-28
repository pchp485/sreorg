import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obligationsForMonth, type ComplianceProfile } from "@sreorg/tax-india";
import DeadlineExplorer from "../../../../components/DeadlineExplorer";

type Params = Promise<{ year: string; month: string }>;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const TITLE_CASE = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Two years of month pages: the queries are seasonal and repeat every year. */
export function generateStaticParams() {
  const thisYear = new Date().getUTCFullYear();
  return [thisYear, thisYear + 1].flatMap((year) =>
    MONTHS.map((month) => ({ year: String(year), month })));
}

export const dynamicParams = true;

function parse(year: string, month: string): { year: number; month: number } | null {
  const y = Number(year);
  const m = MONTHS.indexOf(month.toLowerCase());
  if (!Number.isInteger(y) || y < 2024 || y > 2100 || m === -1) return null;
  return { year: y, month: m };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { year, month } = await params;
  const parsed = parse(year, month);
  if (!parsed) return {};
  const label = `${TITLE_CASE(month)} ${parsed.year}`;
  return {
    title: `GST, TDS and PF due dates — ${label}`,
    description: `Every statutory deadline falling in ${label} for Indian businesses: GSTR-1, GSTR-3B, TDS payment and returns, PF and ESI, advance tax and ROC filings, with the penalty for each.`,
    alternates: { canonical: `/due/${parsed.year}/${month.toLowerCase()}` },
  };
}

/** The widest profile, so the page lists everything and the reader filters below. */
const EVERYTHING: ComplianceProfile = {
  entityType: "private_limited",
  gstRegistered: true,
  gstScheme: "monthly",
  deductsTds: true,
  hasEmployees: true,
  stateCode: "29",
};

export default async function DuePage({ params }: { params: Params }) {
  const { year, month } = await params;
  const parsed = parse(year, month);
  if (!parsed) notFound();

  const label = `${TITLE_CASE(month)} ${parsed.year}`;
  const obligations = obligationsForMonth(EVERYTHING, parsed.year, parsed.month);

  const prev = parsed.month === 0
    ? { y: parsed.year - 1, m: 11 } : { y: parsed.year, m: parsed.month - 1 };
  const next = parsed.month === 11
    ? { y: parsed.year + 1, m: 0 } : { y: parsed.year, m: parsed.month + 1 };

  return (
    <>
      <h1>Compliance due dates — {label}</h1>
      <p className="lede">
        Everything that can fall due in {label}. Not all of it applies to you — use the filter
        below to cut it down to your business.
      </p>

      <div className="scroll">
        <table>
          <thead><tr><th>Due</th><th>Obligation</th><th>Miss it and…</th></tr></thead>
          <tbody>
            {obligations.map((o) => (
              <tr key={`${o.code}-${o.dueDate.toISOString()}`}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {o.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}
                </td>
                <td>{o.label}</td>
                <td style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{o.penalty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Only what applies to you</h2>
      <DeadlineExplorer />

      <div className="card" style={{ marginTop: 24 }}>
        <strong>Get this as an email instead.</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          ₹199/month, one reminder a week before each deadline that is actually yours.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>

      <p style={{ marginTop: 32 }}>
        <Link href={`/due/${prev.y}/${MONTHS[prev.m]}`}>← {TITLE_CASE(MONTHS[prev.m])} {prev.y}</Link>
        {"  ·  "}
        <Link href={`/due/${next.y}/${MONTHS[next.m]}`}>{TITLE_CASE(MONTHS[next.m])} {next.y} →</Link>
      </p>
    </>
  );
}
