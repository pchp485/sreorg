import { STATE_CODES } from "@sreorg/tax-india";
import { stateSlugs } from "@sreorg/growth";

/**
 * "In hand salary for 12 LPA in Karnataka" is one of the highest-volume
 * long-tail queries in Indian search, and every result for it is a calculator
 * that ignores professional tax. CTC brackets x states covers the whole space.
 */
export const CTC_BRACKETS = [
  300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 1_000_000,
  1_200_000, 1_500_000, 1_800_000, 2_000_000, 2_500_000, 3_000_000,
  4_000_000, 5_000_000,
];

export const STATES = stateSlugs(STATE_CODES);

/** Renders 1200000 as "12 LPA", 750000 as "7.5 LPA". */
export function lakhsLabel(annualCtc: number): string {
  const lakhs = annualCtc / 100_000;
  return `${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)} LPA`;
}

export interface SalaryPage {
  slug: string;
  annualCtc: number;
  state: { code: string; name: string; slug: string };
  title: string;
  description: string;
}

export function buildSalaryPage(ctcParam: string, stateSlug: string): SalaryPage | null {
  const annualCtc = Number(ctcParam);
  if (!CTC_BRACKETS.includes(annualCtc)) return null;
  const state = STATES.find((s) => s.slug === stateSlug);
  if (!state) return null;

  return {
    slug: `${annualCtc}/${stateSlug}`,
    annualCtc,
    state,
    title: `In-hand salary for ${lakhsLabel(annualCtc)} CTC in ${state.name}`,
    description:
      `What a ₹${lakhsLabel(annualCtc)} package actually pays each month in ${state.name}, after provident fund, ESI, ${state.name} professional tax and TDS — with the employer contributions that sit inside CTC separated out.`,
  };
}

export function allSalaryPages(): SalaryPage[] {
  const pages: SalaryPage[] = [];
  for (const ctc of CTC_BRACKETS) {
    for (const state of STATES) {
      const page = buildSalaryPage(String(ctc), state.slug);
      if (page) pages.push(page);
    }
  }
  return pages;
}
