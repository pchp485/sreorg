import { resolve } from "node:path";
import type { ContentSpec, ContentTarget } from "@sreorg/growth";
import { professionalTax } from "@sreorg/tax-india";
import { buildPayslip } from "@sreorg/tax-india";
import { rupeesToPaise, formatINR } from "@sreorg/core";
import { CTC_BRACKETS, STATES, lakhsLabel } from "./pseo";

export const payrollSpec: ContentSpec = {
  product: "payroll",
  outputPath: resolve(process.cwd(), "apps/payroll/src/content/generated/faqs.json"),
  candidates(existing: Set<string>): ContentTarget[] {
    const out: ContentTarget[] = [];
    const bigStates = ["karnataka", "maharashtra", "delhi", "tamil-nadu", "telangana"];
    const commonCtc = [600_000, 1_000_000, 1_200_000, 1_500_000, 2_000_000];

    for (const stateSlug of bigStates) {
      const state = STATES.find((s) => s.slug === stateSlug);
      if (!state) continue;

      for (const ctc of commonCtc) {
        const page = `${ctc}/${state.slug}`;
        if (existing.has(page) || !CTC_BRACKETS.includes(ctc)) continue;

        // Facts are computed from the same engine that renders the page, so the
        // model is never asked to do arithmetic it might get wrong.
        const slip = buildPayslip({
          ctcPaise: Math.round(rupeesToPaise(ctc) / 12),
          stateCode: state.code,
        });
        const pt = professionalTax(state.code, slip.earnings.grossPaise);

        out.push({
          page,
          description: `In-hand salary for ${lakhsLabel(ctc)} CTC in ${state.name}`,
          verifiedFacts: [
            `Annual CTC: ₹${ctc.toLocaleString("en-IN")} (${lakhsLabel(ctc)})`,
            `State: ${state.name}`,
            `Monthly gross: ${formatINR(slip.earnings.grossPaise)}`,
            `Monthly in-hand after all deductions: ${formatINR(slip.netPayPaise)}`,
            `Employee provident fund deduction: ${formatINR(slip.deductions.epfEmployee)} per month`,
            pt.configured
              ? `${state.name} professional tax at this salary: ${formatINR(pt.amountPaise)} per month`
              : `Professional tax slabs for ${state.name} are not configured — do not state an amount`,
            `Monthly TDS under the new regime: ${formatINR(slip.deductions.tds)}`,
            "CTC includes the employer's provident fund contribution and the gratuity provision; neither is part of the employee's gross salary.",
            "Provident fund contributions are computed on basic salary capped at ₹15,000 per month.",
            "ESI applies only while monthly gross is ₹21,000 or below.",
          ],
        });
      }
    }
    return out;
  },
};
