import { describe, expect, it } from "vitest";
import {
  annualIncomeTax, buildPayslip, professionalTax, slabTax,
} from "@sreorg/tax-india";
import { rupeesToPaise } from "@sreorg/core";

const monthlyCtcFor = (annual: number) => Math.round(rupeesToPaise(annual) / 12);

describe("slab tax", () => {
  const slabs = [
    { upToPaise: 40_000_000, rate: 0 },
    { upToPaise: 80_000_000, rate: 5 },
    { upToPaise: null, rate: 10 },
  ];

  it("charges nothing inside the exempt band", () => {
    expect(slabTax(rupeesToPaise(350_000), slabs)).toBe(0);
  });

  it("taxes only the amount inside each band, not the whole income", () => {
    // Rs 6L: nothing on the first 4L, 5% on the next 2L = Rs 10,000.
    expect(slabTax(rupeesToPaise(600_000), slabs)).toBe(rupeesToPaise(10_000));
  });

  it("carries through into the top open-ended band", () => {
    // Rs 10L: 0 + 5% of 4L (20,000) + 10% of 2L (20,000) = Rs 40,000.
    expect(slabTax(rupeesToPaise(1_000_000), slabs)).toBe(rupeesToPaise(40_000));
  });
});

describe("section 87A rebate", () => {
  it("is a cliff, not a slab: one rupee over the ceiling and the whole tax is payable", () => {
    const under = annualIncomeTax({ grossAnnualPaise: rupeesToPaise(1_275_000) });
    const over = annualIncomeTax({ grossAnnualPaise: rupeesToPaise(1_400_000) });

    expect(under.rebateApplied).toBe(true);
    expect(under.totalPaise).toBe(0);
    expect(over.rebateApplied).toBe(false);
    expect(over.totalPaise).toBeGreaterThan(0);
  });

  it("applies the standard deduction before testing the ceiling", () => {
    // Rs 12.75L gross - Rs 75,000 standard deduction lands exactly on Rs 12L.
    const result = annualIncomeTax({ grossAnnualPaise: rupeesToPaise(1_275_000) });
    expect(result.taxableIncomePaise).toBe(rupeesToPaise(1_200_000));
    expect(result.rebateApplied).toBe(true);
  });

  it("adds 4% cess on top of the tax once it is payable", () => {
    const result = annualIncomeTax({ grossAnnualPaise: rupeesToPaise(2_000_000) });
    expect(result.cessPaise).toBe(Math.round(result.taxBeforeCessPaise * 0.04));
    expect(result.totalPaise).toBe(result.taxBeforeCessPaise + result.cessPaise);
  });
});

describe("professional tax", () => {
  it("reports a state it has verified", () => {
    const result = professionalTax("29", rupeesToPaise(60_000));
    expect(result.configured).toBe(true);
    expect(result.stateName).toBe("Karnataka");
    expect(result.amountPaise).toBe(rupeesToPaise(200));
  });

  it("charges nothing below the state's threshold", () => {
    expect(professionalTax("29", rupeesToPaise(20_000)).amountPaise).toBe(0);
  });

  it("reports zero for a state that levies none, and says so", () => {
    const delhi = professionalTax("07", rupeesToPaise(200_000));
    expect(delhi.configured).toBe(true);
    expect(delhi.amountPaise).toBe(0);
  });

  it("flags an unverified state instead of guessing zero", () => {
    const result = professionalTax("18", rupeesToPaise(60_000));
    expect(result.configured).toBe(false);
    expect(result.amountPaise).toBe(0);
  });

  it("adds the February surcharge only in February, and only where it exists", () => {
    const feb = professionalTax("27", rupeesToPaise(50_000), 2);
    const jan = professionalTax("27", rupeesToPaise(50_000), 1);
    expect(feb.amountPaise).toBe(jan.amountPaise + rupeesToPaise(100));
    // Karnataka has no February surcharge.
    expect(professionalTax("29", rupeesToPaise(50_000), 2).amountPaise)
      .toBe(professionalTax("29", rupeesToPaise(50_000), 1).amountPaise);
  });
});

describe("payslip", () => {
  it("keeps employer contributions out of the employee's gross", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(1_200_000), stateCode: "29" });
    // Gross plus what the employer pays on top must reconcile back to CTC.
    expect(slip.earnings.grossPaise + slip.employerCost.epfEmployer + slip.employerCost.gratuity)
      .toBe(monthlyCtcFor(1_200_000));
    expect(slip.earnings.grossPaise).toBeLessThan(monthlyCtcFor(1_200_000));
  });

  it("caps provident fund at the Rs 15,000 wage ceiling", () => {
    const high = buildPayslip({ ctcPaise: monthlyCtcFor(5_000_000), stateCode: "29" });
    // 12% of the Rs 15,000 ceiling is Rs 1,800, however large the salary.
    expect(high.deductions.epfEmployee).toBe(rupeesToPaise(1_800));
  });

  it("applies ESI only at or below the gross ceiling", () => {
    const low = buildPayslip({ ctcPaise: rupeesToPaise(18_000), stateCode: "29" });
    const high = buildPayslip({ ctcPaise: rupeesToPaise(60_000), stateCode: "29" });
    expect(low.deductions.esiEmployee).toBeGreaterThan(0);
    expect(high.deductions.esiEmployee).toBe(0);
  });

  it("drops both sides of provident fund when it does not apply", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(1_200_000), stateCode: "29", pfOptedIn: false });
    expect(slip.deductions.epfEmployee).toBe(0);
    expect(slip.employerCost.epfEmployer).toBe(0);
  });

  it("nets out to gross minus every deduction", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(1_800_000), stateCode: "27", month: 2 });
    expect(slip.netPayPaise).toBe(slip.earnings.grossPaise - slip.deductions.totalPaise);
    expect(slip.deductions.totalPaise).toBe(
      slip.deductions.epfEmployee + slip.deductions.esiEmployee
      + slip.deductions.professionalTax + slip.deductions.tds,
    );
  });

  it("warns rather than silently deducting nothing for an unconfigured state", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(1_200_000), stateCode: "18" });
    expect(slip.deductions.professionalTaxConfigured).toBe(false);
    expect(slip.warnings.join(" ")).toMatch(/not configured/i);
  });

  it("warns when basic is set below the level the Code on Wages expects", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(1_200_000), stateCode: "29", basicPercent: 25 });
    expect(slip.warnings.join(" ")).toMatch(/below 40%/i);
  });

  it("charges no TDS on a salary the rebate covers", () => {
    const slip = buildPayslip({ ctcPaise: monthlyCtcFor(900_000), stateCode: "29" });
    expect(slip.deductions.tds).toBe(0);
  });
});
