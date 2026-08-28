export interface ToolMeta {
  slug: string;
  name: string;
  headline: string;
  description: string;
}

/**
 * Free, no-signup calculators. These are the top-of-funnel: they rank, they
 * get used, and every one of them ends in the same call to action.
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: "gst-calculator",
    name: "GST Calculator",
    headline: "Add or remove GST, with CGST/SGST vs IGST worked out for you",
    description:
      "Compute GST inclusive and exclusive amounts at 0.1%, 3%, 5%, 12%, 18% and 28%, split correctly into CGST + SGST for intra-state supply or IGST for inter-state supply.",
  },
  {
    slug: "gstin-validator",
    name: "GSTIN Validator",
    headline: "Check a GSTIN before you invoice, not after",
    description:
      "Validates the 15-character GSTIN structure and its mod-36 checksum digit, and tells you which state it belongs to — so you know whether to charge CGST+SGST or IGST.",
  },
  {
    slug: "tds-calculator",
    name: "TDS Calculator",
    headline: "See exactly what your client will hold back",
    description:
      "Works out TDS under sections 194J, 194C, 194H and 194I on the taxable value (never on GST), applies annual thresholds, and applies the 20% floor under section 206AA when PAN is missing.",
  },
  {
    slug: "invoice-generator",
    name: "GST Invoice Generator",
    headline: "A compliant invoice in about ninety seconds",
    description:
      "Generates a GST-compliant tax invoice with per-slab tax rollup, whole-rupee round-off under Section 170, and every field the rules require. Free for three invoices a month.",
  },
];

export function findTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
