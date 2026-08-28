import {
  CESS_PERCENT, EPF, ESI, INCOME_TAX, PROFESSIONAL_TAX,
  RATE_CONFIG_VERSION, type TaxSlab,
} from "./rates/fy2025-26";

export type Paise = number;
export type Regime = "new" | "old";

export interface EmployeeInput {
  /** Monthly cost to company, in paise. Every component is derived from this. */
  ctcPaise: Paise;
  /** Basic as a percentage of CTC. Convention is 40-50%; below 40% invites scrutiny. */
  basicPercent?: number;
  stateCode: string;
  regime?: Regime;
  pfOptedIn?: boolean;
  /** Payroll month, 1-12. Only matters where a state charges extra in February. */
  month?: number;
  /** Declared 80C/80D etc. deductions, old regime only. */
  oldRegimeDeductionsPaise?: Paise;
}

export interface PayslipBreakdown {
  rateConfig: string;
  earnings: { basic: Paise; hra: Paise; specialAllowance: Paise; grossPaise: Paise };
  employerCost: { epfEmployer: Paise; eps: Paise; esiEmployer: Paise; gratuity: Paise; totalCtc: Paise };
  deductions: {
    epfEmployee: Paise;
    esiEmployee: Paise;
    professionalTax: Paise;
    professionalTaxConfigured: boolean;
    tds: Paise;
    totalPaise: Paise;
  };
  netPayPaise: Paise;
  /** Anything the operator must check by hand before this slip is trustworthy. */
  warnings: string[];
}

const round = (n: number): Paise => Math.round(n);
const pct = (amount: Paise, percent: number): Paise => round((amount * percent) / 100);

/**
 * Professional tax for a state and monthly gross. Returns configured:false for a
 * state whose slabs have not been verified, so the caller can surface that rather
 * than silently deducting zero and getting the employer a penalty.
 */
export function professionalTax(
  stateCode: string,
  monthlyGrossPaise: Paise,
  month = 1,
): { amountPaise: Paise; configured: boolean; stateName?: string } {
  const config = PROFESSIONAL_TAX[stateCode];
  if (!config) return { amountPaise: 0, configured: false };

  let amount = 0;
  for (const slab of config.slabs) {
    if (monthlyGrossPaise > slab.aboveMonthlyPaise) amount = slab.amountPaise;
  }
  // A few states levy an extra amount in the last month of the financial year.
  if (month === 2 && amount > 0 && config.februaryExtraPaise) amount += config.februaryExtraPaise;

  return { amountPaise: amount, configured: true, stateName: config.name };
}

/** Progressive slab tax on an annual taxable income, before rebate and cess. */
export function slabTax(taxableAnnualPaise: Paise, slabs: readonly TaxSlab[]): Paise {
  let tax = 0;
  let previousCeiling = 0;

  for (const slab of slabs) {
    const ceiling = slab.upToPaise ?? Infinity;
    if (taxableAnnualPaise <= previousCeiling) break;
    const bandAmount = Math.min(taxableAnnualPaise, ceiling) - previousCeiling;
    tax += (bandAmount * slab.rate) / 100;
    previousCeiling = ceiling;
  }
  return round(tax);
}

export interface AnnualTax { taxableIncomePaise: Paise; taxBeforeCessPaise: Paise; cessPaise: Paise; totalPaise: Paise; rebateApplied: boolean }

/**
 * Annual income tax on salary. Section 87A is a full rebate, not a slab: at one
 * rupee over the ceiling the whole tax becomes payable, which is why the rebate
 * is applied to the computed tax rather than folded into the slabs.
 */
export function annualIncomeTax(args: {
  grossAnnualPaise: Paise;
  regime?: Regime;
  otherDeductionsPaise?: Paise;
}): AnnualTax {
  const regime = args.regime ?? "new";
  const config = INCOME_TAX[regime];

  const deductions = config.standardDeductionPaise
    + (regime === "old" ? (args.otherDeductionsPaise ?? 0) : 0);
  const taxable = Math.max(0, args.grossAnnualPaise - deductions);

  const rebateApplied = taxable <= config.rebateCeilingPaise;
  const taxBeforeCess = rebateApplied ? 0 : slabTax(taxable, config.slabs);
  const cess = pct(taxBeforeCess, CESS_PERCENT);

  return {
    taxableIncomePaise: taxable,
    taxBeforeCessPaise: taxBeforeCess,
    cessPaise: cess,
    totalPaise: taxBeforeCess + cess,
    rebateApplied,
  };
}

/**
 * Builds one month's payslip from CTC.
 *
 * CTC includes the employer's own contributions, so gross pay is CTC minus
 * employer PF and the gratuity provision — getting this backwards is the single
 * most common payroll error and it overstates every employee's salary.
 */
export function buildPayslip(input: EmployeeInput): PayslipBreakdown {
  const warnings: string[] = [];
  const basicPercent = input.basicPercent ?? 50;
  const regime = input.regime ?? "new";
  const pfOptedIn = input.pfOptedIn ?? true;
  const month = input.month ?? 1;

  if (basicPercent < 40) {
    warnings.push("Basic is below 40% of CTC, which draws scrutiny under the Code on Wages.");
  }

  const basic = pct(input.ctcPaise, basicPercent);
  const hra = pct(basic, 50);

  // Employer-side costs sit inside CTC and never reach the employee's gross.
  const pfWage = Math.min(basic, EPF.wageCeilingPaise);
  const epfEmployer = pfOptedIn ? pct(pfWage, EPF.employerPercent) : 0;
  const eps = pfOptedIn ? pct(Math.min(basic, EPF.epsWageCeilingPaise), EPF.employerPensionPercent) : 0;
  const gratuity = round(basic * 0.0481);

  const specialAllowance = Math.max(0, input.ctcPaise - basic - hra - epfEmployer - gratuity);
  const gross = basic + hra + specialAllowance;

  const epfEmployee = pfOptedIn ? pct(pfWage, EPF.employeePercent) : 0;

  const esiApplies = gross <= ESI.grossCeilingPaise;
  const esiEmployee = esiApplies ? pct(gross, ESI.employeePercent) : 0;
  const esiEmployer = esiApplies ? pct(gross, ESI.employerPercent) : 0;

  const pt = professionalTax(input.stateCode, gross, month);
  if (!pt.configured) {
    warnings.push(
      `Professional tax slabs for state code ${input.stateCode} are not configured. ` +
      "Verify against the state notification before relying on this payslip.",
    );
  }

  // TDS is computed on the annual picture and spread evenly across twelve months.
  const annual = annualIncomeTax({
    grossAnnualPaise: gross * 12,
    regime,
    otherDeductionsPaise: input.oldRegimeDeductionsPaise,
  });
  const tds = round(annual.totalPaise / 12);

  const totalDeductions = epfEmployee + esiEmployee + pt.amountPaise + tds;

  return {
    rateConfig: RATE_CONFIG_VERSION,
    earnings: { basic, hra, specialAllowance, grossPaise: gross },
    employerCost: {
      epfEmployer, eps, esiEmployer, gratuity,
      totalCtc: gross + epfEmployer + gratuity + esiEmployer,
    },
    deductions: {
      epfEmployee,
      esiEmployee,
      professionalTax: pt.amountPaise,
      professionalTaxConfigured: pt.configured,
      tds,
      totalPaise: totalDeductions,
    },
    netPayPaise: gross - totalDeductions,
    warnings,
  };
}
