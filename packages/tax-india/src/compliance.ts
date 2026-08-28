/**
 * Statutory deadline calendar.
 *
 * Deadlines here are the standard statutory dates. The government extends them
 * by notification several times a year, and this file cannot know about that —
 * an extension only ever moves a date later, so a reminder based on the
 * statutory date is early rather than wrong.
 */
export type EntityType = "proprietor" | "llp" | "private_limited";

export interface ComplianceProfile {
  entityType: EntityType;
  gstRegistered: boolean;
  gstScheme: "monthly" | "qrmp";
  deductsTds: boolean;
  hasEmployees: boolean;
  stateCode: string;
}

export interface Obligation {
  code: string;
  label: string;
  dueDate: Date;
  /** What it costs to miss it — the reason the reminder is worth paying for. */
  penalty: string;
}

/** QRMP filers in these states file GSTR-3B on the 22nd; everyone else the 24th. */
const QRMP_GROUP_A = new Set([
  "22", "23", "24", "26", "27", "29", "30", "31", "32", "33", "34", "35", "36", "37",
]);

const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month, day, 0, 0, 0));

/** Quarter end months (0-indexed): Jun, Sep, Dec, Mar. */
const isQuarterEndMonth = (month: number): boolean => [2, 5, 8, 11].includes(month);

/**
 * Every obligation falling due in the given month, for this profile.
 * `month` is 0-indexed to match Date.
 */
export function obligationsForMonth(
  profile: ComplianceProfile,
  year: number,
  month: number,
): Obligation[] {
  const out: Obligation[] = [];
  // Most filings relate to the *previous* month's activity.
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const monthName = (m: number) =>
    ["January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"][m];

  if (profile.gstRegistered && profile.gstScheme === "monthly") {
    out.push({
      code: "gstr1",
      label: `GSTR-1 for ${monthName(prevMonth)}`,
      dueDate: utc(year, month, 11),
      penalty: "Rs 50/day late fee, and your customer cannot claim input credit until it is filed.",
    });
    out.push({
      code: "gstr3b",
      label: `GSTR-3B for ${monthName(prevMonth)}`,
      dueDate: utc(year, month, 20),
      penalty: "Rs 50/day late fee plus 18% annual interest on the tax due.",
    });
  }

  if (profile.gstRegistered && profile.gstScheme === "qrmp" && isQuarterEndMonth(prevMonth)) {
    const day = QRMP_GROUP_A.has(profile.stateCode) ? 22 : 24;
    out.push({
      code: "gstr3b_qrmp",
      label: `Quarterly GSTR-3B for the quarter ending ${monthName(prevMonth)}`,
      dueDate: utc(year, month, day),
      penalty: "Rs 50/day late fee plus 18% annual interest on the tax due.",
    });
    out.push({
      code: "gstr1_qrmp",
      label: `Quarterly GSTR-1 for the quarter ending ${monthName(prevMonth)}`,
      dueDate: utc(year, month, 13),
      penalty: "Rs 50/day late fee, and your customer cannot claim input credit until it is filed.",
    });
  }

  if (profile.deductsTds) {
    // TDS deducted in March is payable by 30 April, not the usual 7th.
    out.push(
      prevMonth === 2
        ? {
            code: "tds_payment",
            label: "TDS payment for March",
            dueDate: utc(year, 3, 30),
            penalty: "1.5% interest per month, and the expense is disallowed until paid.",
          }
        : {
            code: "tds_payment",
            label: `TDS payment for ${monthName(prevMonth)}`,
            dueDate: utc(year, month, 7),
            penalty: "1.5% interest per month, and the expense is disallowed until paid.",
          },
    );

    const tdsReturn: Record<number, { label: string; day: number }> = {
      6: { label: "Q1 (Apr-Jun)", day: 31 },   // due 31 July
      9: { label: "Q2 (Jul-Sep)", day: 31 },   // due 31 October
      0: { label: "Q3 (Oct-Dec)", day: 31 },   // due 31 January
      4: { label: "Q4 (Jan-Mar)", day: 31 },   // due 31 May
    };
    const q = tdsReturn[month];
    if (q) {
      out.push({
        code: "tds_return",
        label: `TDS return ${q.label}`,
        dueDate: utc(year, month, q.day),
        penalty: "Rs 200/day under section 234E until filed, capped at the TDS amount.",
      });
    }
  }

  if (profile.hasEmployees) {
    out.push({
      code: "pf_esi",
      label: `PF and ESI payment for ${monthName(prevMonth)}`,
      dueDate: utc(year, month, 15),
      penalty: "12% annual interest plus damages up to 25%, and it is a criminal liability for directors.",
    });
  }

  // Advance tax, for anyone with a tax liability above Rs 10,000 for the year.
  const advanceTax: Record<number, string> = {
    5: "15% of estimated annual tax", 8: "45% cumulative",
    11: "75% cumulative", 2: "100% cumulative",
  };
  if (advanceTax[month]) {
    out.push({
      code: "advance_tax",
      label: `Advance tax instalment — ${advanceTax[month]}`,
      dueDate: utc(year, month, 15),
      penalty: "1% interest per month under sections 234B and 234C on the shortfall.",
    });
  }

  if (month === 6) {
    out.push({
      code: "itr",
      label: "Income tax return (no audit required)",
      dueDate: utc(year, 6, 31),
      penalty: "Up to Rs 5,000 under section 234F, and losses cannot be carried forward.",
    });
  }

  if (profile.entityType === "private_limited") {
    if (month === 9) {
      out.push({
        code: "aoc4",
        label: "AOC-4 — annual financial statements",
        dueDate: utc(year, 9, 30),
        penalty: "Rs 100/day with no upper limit.",
      });
    }
    if (month === 10) {
      out.push({
        code: "mgt7",
        label: "MGT-7 — annual return",
        dueDate: utc(year, 10, 29),
        penalty: "Rs 100/day with no upper limit.",
      });
    }
  }

  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/** Obligations falling due in a window — what the reminder engine actually asks for. */
export function obligationsDueBetween(
  profile: ComplianceProfile,
  from: Date,
  to: Date,
): Obligation[] {
  const out: Obligation[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));

  while (cursor <= to) {
    for (const o of obligationsForMonth(profile, cursor.getUTCFullYear(), cursor.getUTCMonth())) {
      if (o.dueDate >= from && o.dueDate <= to) out.push(o);
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
