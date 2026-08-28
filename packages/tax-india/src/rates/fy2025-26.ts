/**
 * Statutory rates, as data.
 *
 * The engine that consumes this file is unit-tested and provably correct; the
 * NUMBERS here are only as correct as the last human who checked them against
 * the Finance Act. They change every Budget. Nothing in this repo can verify
 * them for you.
 *
 * Review checklist, once a year in February:
 *   - Income tax slabs and standard deduction (Finance Act)
 *   - Section 87A rebate threshold
 *   - EPF wage ceiling and contribution split
 *   - ESI wage ceiling and contribution rates
 *   - Professional tax slabs for every state listed below
 */
export const RATE_CONFIG_VERSION = "FY2025-26";
export const LAST_VERIFIED = "2026-08-28";

export interface TaxSlab { upToPaise: number | null; rate: number }

export const INCOME_TAX = {
  new: {
    standardDeductionPaise: 7_500_000,      // Rs 75,000
    /** Section 87A: taxable income at or below this makes tax nil. */
    rebateCeilingPaise: 120_000_000,        // Rs 12,00,000
    slabs: [
      { upToPaise: 40_000_000, rate: 0 },   // up to Rs 4L
      { upToPaise: 80_000_000, rate: 5 },   // Rs 4L - 8L
      { upToPaise: 120_000_000, rate: 10 }, // Rs 8L - 12L
      { upToPaise: 160_000_000, rate: 15 }, // Rs 12L - 16L
      { upToPaise: 200_000_000, rate: 20 }, // Rs 16L - 20L
      { upToPaise: 240_000_000, rate: 25 }, // Rs 20L - 24L
      { upToPaise: null, rate: 30 },
    ] as TaxSlab[],
  },
  old: {
    standardDeductionPaise: 5_000_000,      // Rs 50,000
    rebateCeilingPaise: 50_000_000,         // Rs 5,00,000
    slabs: [
      { upToPaise: 25_000_000, rate: 0 },
      { upToPaise: 50_000_000, rate: 5 },
      { upToPaise: 100_000_000, rate: 20 },
      { upToPaise: null, rate: 30 },
    ] as TaxSlab[],
  },
} as const;

/** Health and education cess, applied on the tax after rebate. */
export const CESS_PERCENT = 4;

export const EPF = {
  /** Contributions are computed on basic+DA capped at this monthly wage. */
  wageCeilingPaise: 1_500_000,              // Rs 15,000
  employeePercent: 12,
  employerPercent: 12,
  /** Of the employer's 12%, this share goes to the pension scheme (EPS). */
  employerPensionPercent: 8.33,
  epsWageCeilingPaise: 1_500_000,
} as const;

export const ESI = {
  /** ESI applies only while monthly gross is at or below this. */
  grossCeilingPaise: 2_100_000,             // Rs 21,000
  employeePercent: 0.75,
  employerPercent: 3.25,
} as const;

export interface PtSlab { aboveMonthlyPaise: number; amountPaise: number }

/**
 * Professional tax is levied by states, not the centre, and the slabs differ in
 * every one. Only states verified against the state's own notification are
 * listed. An unlisted state returns `configured: false` rather than a guess —
 * silently deducting the wrong PT is a real payroll error with a real penalty.
 */
export const PROFESSIONAL_TAX: Record<string, { name: string; slabs: PtSlab[]; februaryExtraPaise?: number }> = {
  "29": { name: "Karnataka", slabs: [{ aboveMonthlyPaise: 2_500_000, amountPaise: 20_000 }] },
  "27": {
    name: "Maharashtra",
    slabs: [
      { aboveMonthlyPaise: 750_000, amountPaise: 17_500 },
      { aboveMonthlyPaise: 1_000_000, amountPaise: 20_000 },
    ],
    februaryExtraPaise: 10_000,
  },
  "19": { name: "West Bengal", slabs: [
    { aboveMonthlyPaise: 1_000_000, amountPaise: 11_000 },
    { aboveMonthlyPaise: 1_500_000, amountPaise: 13_000 },
    { aboveMonthlyPaise: 2_500_000, amountPaise: 20_000 },
  ] },
  "33": { name: "Tamil Nadu", slabs: [
    { aboveMonthlyPaise: 2_100_000, amountPaise: 10_100 },
    { aboveMonthlyPaise: 3_000_000, amountPaise: 20_800 },
    { aboveMonthlyPaise: 4_500_000, amountPaise: 41_500 },
    { aboveMonthlyPaise: 6_000_000, amountPaise: 62_500 },
    { aboveMonthlyPaise: 7_500_000, amountPaise: 83_300 },
  ] },
  "36": { name: "Telangana", slabs: [
    { aboveMonthlyPaise: 1_500_000, amountPaise: 15_000 },
    { aboveMonthlyPaise: 2_000_000, amountPaise: 20_000 },
  ] },
  "24": { name: "Gujarat", slabs: [{ aboveMonthlyPaise: 1_200_000, amountPaise: 20_000 }] },
  "07": { name: "Delhi", slabs: [] },
  "09": { name: "Uttar Pradesh", slabs: [] },
  "06": { name: "Haryana", slabs: [] },
};
