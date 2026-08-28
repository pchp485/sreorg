import { resolve } from "node:path";
import type { ContentSpec, ContentTarget } from "@sreorg/growth";
import { PROFESSIONS, STATES } from "./pseo";

/**
 * Every fact handed to the model is one this repo can point at. It is told not
 * to use anything else, and a question it cannot answer from these it must skip.
 */
export const invoicingSpec: ContentSpec = {
  product: "invoicing",
  outputPath: resolve(process.cwd(), "apps/invoicing/src/content/generated/faqs.json"),
  candidates(existing: Set<string>): ContentTarget[] {
    const out: ContentTarget[] = [];
    const bigStates = ["karnataka", "maharashtra", "delhi", "tamil-nadu", "telangana", "gujarat"];

    for (const stateSlug of bigStates) {
      const state = STATES.find((s) => s.slug === stateSlug);
      if (!state) continue;

      for (const profession of PROFESSIONS) {
        const page = `${profession.slug}/${state.slug}`;
        if (existing.has(page)) continue;

        out.push({
          page,
          description: `GST invoice format for ${profession.plural} in ${state.name}`,
          verifiedFacts: [
            `SAC code for this profession: ${profession.sac}`,
            `GST rate: ${profession.gstRate}%`,
            `State: ${state.name}, GST state code ${state.code}`,
            "Intra-state supply splits into CGST + SGST at half the rate each; inter-state is a single IGST charge at the full rate.",
            `TDS section that applies: ${profession.tdsSection.split("_")[0]}`,
            "TDS is deducted on taxable value only, never on the GST component.",
            "Invoice totals are rounded to the nearest rupee under Section 170 of the CGST Act.",
          ],
        });
      }
    }
    return out;
  },
};
