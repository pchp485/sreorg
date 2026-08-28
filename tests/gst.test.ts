import { describe, expect, it } from "vitest";
import { computeGst, computeTds, isIntraState, validateGstin, type LineItem } from "@sreorg/tax-india";
import { formatINR, roundToNearestRupee, rupeesToPaise } from "@sreorg/core";

const item = (rupees: number, rate: LineItem["gstRate"], qty = 1): LineItem => ({
  description: "svc", hsnSac: "998314", quantity: qty, unitPricePaise: rupeesToPaise(rupees), gstRate: rate,
});

describe("intra vs inter state", () => {
  it("splits into CGST and SGST within the same state", () => {
    const r = computeGst([item(10000, 18)], "29", "29");
    expect(r.igstPaise).toBe(0);
    expect(r.cgstPaise).toBe(90000);
    expect(r.sgstPaise).toBe(90000);
    expect(r.totalPaise).toBe(1180000);
  });

  it("charges a single IGST line across states", () => {
    const r = computeGst([item(10000, 18)], "29", "27");
    expect(r.cgstPaise).toBe(0);
    expect(r.sgstPaise).toBe(0);
    expect(r.igstPaise).toBe(180000);
    expect(r.totalPaise).toBe(1180000);
  });

  it("classifies supply by state code", () => {
    expect(isIntraState("29", "29")).toBe(true);
    expect(isIntraState("29", "07")).toBe(false);
  });
});

describe("tax arithmetic", () => {
  it("never loses a paisa when halving an odd tax amount", () => {
    // 18% of 1234.57 = 222.2226 -> 22222 paise, which is even; use a value that isn't.
    const r = computeGst([item(555.55, 5)], "29", "29");
    expect(r.cgstPaise + r.sgstPaise).toBe(Math.round((rupeesToPaise(555.55) * 5) / 100));
    expect(r.cgstPaise - r.sgstPaise).toBeLessThanOrEqual(1);
  });

  it("groups by rate slab rather than per line", () => {
    const r = computeGst([item(100, 18), item(100, 18), item(100, 5)], "29", "27");
    expect(r.byRate).toHaveLength(2);
    const eighteen = r.byRate.find((b: { rate: number }) => b.rate === 18)!;
    expect(eighteen.taxablePaise).toBe(20000);
    expect(eighteen.igst).toBe(3600);
  });

  it("rounds the invoice total to a whole rupee under Section 170", () => {
    const r = computeGst([item(1000.4, 18)], "29", "27");
    expect(r.totalPaise % 100).toBe(0);
    expect(r.subtotalPaise + r.igstPaise + r.roundOffPaise).toBe(r.totalPaise);
  });

  it("applies quantity and discount before tax", () => {
    const r = computeGst(
      [{ ...item(1000, 18, 3), discountPaise: rupeesToPaise(500) }],
      "29", "29",
    );
    expect(r.subtotalPaise).toBe(rupeesToPaise(2500));
  });

  it("handles a zero-rated supply", () => {
    const r = computeGst([item(10000, 0)], "29", "27");
    expect(r.igstPaise).toBe(0);
    expect(r.totalPaise).toBe(rupeesToPaise(10000));
  });
});

describe("GSTIN validation", () => {
  it("accepts a GSTIN with a correct checksum", () => {
    const result = validateGstin("29AAGCB7383J1Z4");
    expect(result.valid).toBe(true);
    expect(result.state).toBe("Karnataka");
  });

  it("rejects a wrong checksum digit", () => {
    expect(validateGstin("29AAGCB7383J1ZN").valid).toBe(false);
  });

  it("rejects an unknown state code", () => {
    const r = validateGstin("99AAGCB7383J1Z4");
    expect(r.valid).toBe(false);
  });

  it("rejects wrong length and junk", () => {
    expect(validateGstin("29AAGCB7383J1Z").valid).toBe(false);
    expect(validateGstin("not-a-gstin-abc").valid).toBe(false);
  });
});

describe("TDS", () => {
  it("deducts nothing below the annual threshold", () => {
    const r = computeTds({ taxableValuePaise: rupeesToPaise(10000), section: "194J" });
    expect(r.thresholdMet).toBe(false);
    expect(r.tdsPaise).toBe(0);
  });

  it("deducts 10% under 194J once the threshold is crossed", () => {
    const r = computeTds({ taxableValuePaise: rupeesToPaise(100000), section: "194J" });
    expect(r.rate).toBe(10);
    expect(r.tdsPaise).toBe(rupeesToPaise(10000));
    expect(r.netPayablePaise).toBe(rupeesToPaise(90000));
  });

  it("counts earlier payments toward the threshold", () => {
    const r = computeTds({
      taxableValuePaise: rupeesToPaise(5000),
      section: "194J",
      paidToDatePaise: rupeesToPaise(29000),
    });
    expect(r.thresholdMet).toBe(true);
  });

  it("applies the 20% floor when PAN is missing (Sec 206AA)", () => {
    const r = computeTds({ taxableValuePaise: rupeesToPaise(100000), section: "194C_individual", hasPan: false });
    expect(r.rate).toBe(20);
  });
});

describe("money formatting", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(123456789)).toBe("₹12,34,567.89");
    expect(formatINR(39900)).toBe("₹399.00");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(-50000)).toBe("-₹500.00");
  });

  it("rounds half up to the nearest rupee", () => {
    expect(roundToNearestRupee(10050)).toBe(10100);
    expect(roundToNearestRupee(10049)).toBe(10000);
  });
});
