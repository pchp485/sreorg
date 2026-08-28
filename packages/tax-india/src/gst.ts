import { type Paise, roundToNearestRupee } from "@sreorg/core/money";

export type GstRate = 0 | 0.1 | 3 | 5 | 12 | 18 | 28;
export const GST_RATES: GstRate[] = [0, 0.1, 3, 5, 12, 18, 28];

export interface LineItem {
  description: string;
  hsnSac: string;
  quantity: number;
  unitPricePaise: Paise;
  gstRate: GstRate;
  /** Discount applied to this line, in paise, before tax. */
  discountPaise?: Paise;
}

export interface GstBreakdown {
  subtotalPaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalPaise: Paise;
  /** Rounding adjustment applied to reach a whole-rupee total (Sec 170). */
  roundOffPaise: Paise;
  /** Per-rate rollup, required on the invoice face and in GSTR-1. */
  byRate: Array<{ rate: GstRate; taxablePaise: Paise; cgst: Paise; sgst: Paise; igst: Paise }>;
}

/** GST state codes as used in the first two digits of a GSTIN. */
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

/**
 * Supply is intra-state when the supplier's state and the place of supply match:
 * tax splits into CGST + SGST. Otherwise it is inter-state: a single IGST charge.
 * Getting this backwards is the single most common GST invoicing error.
 */
export function isIntraState(supplierStateCode: string, placeOfSupplyCode: string): boolean {
  return supplierStateCode === placeOfSupplyCode;
}

export function lineTaxablePaise(item: LineItem): Paise {
  const gross = Math.round(item.unitPricePaise * item.quantity);
  return Math.max(0, gross - (item.discountPaise ?? 0));
}

export function computeGst(
  items: LineItem[],
  supplierStateCode: string,
  placeOfSupplyCode: string,
): GstBreakdown {
  const intra = isIntraState(supplierStateCode, placeOfSupplyCode);

  // Tax is computed per rate-slab, not per line: summing rounded per-line tax
  // drifts from what the GST portal computes on the slab total.
  const slabs = new Map<GstRate, Paise>();
  let subtotal = 0;

  for (const item of items) {
    const taxable = lineTaxablePaise(item);
    subtotal += taxable;
    slabs.set(item.gstRate, (slabs.get(item.gstRate) ?? 0) + taxable);
  }

  let cgst = 0, sgst = 0, igst = 0;
  const byRate: GstBreakdown["byRate"] = [];

  for (const rate of [...slabs.keys()].sort((a, b) => a - b)) {
    const taxable = slabs.get(rate)!;
    const tax = Math.round((taxable * rate) / 100);

    if (intra) {
      // Split half/half. Give the odd paisa to CGST so cgst+sgst === tax exactly.
      const half = Math.floor(tax / 2);
      const c = tax - half;
      const s = half;
      cgst += c; sgst += s;
      byRate.push({ rate, taxablePaise: taxable, cgst: c, sgst: s, igst: 0 });
    } else {
      igst += tax;
      byRate.push({ rate, taxablePaise: taxable, cgst: 0, sgst: 0, igst: tax });
    }
  }

  const beforeRounding = subtotal + cgst + sgst + igst;
  const total = roundToNearestRupee(beforeRounding);

  return {
    subtotalPaise: subtotal,
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: igst,
    totalPaise: total,
    roundOffPaise: total - beforeRounding,
    byRate,
  };
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CHECKSUM_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Validates GSTIN format *and* its mod-36 check digit, so a typo'd GSTIN is
 * caught before the invoice is sent rather than at return-filing time.
 */
export function validateGstin(gstin: string): { valid: boolean; reason?: string; state?: string } {
  const value = gstin.trim().toUpperCase();
  if (value.length !== 15) return { valid: false, reason: "GSTIN must be 15 characters" };
  if (!GSTIN_RE.test(value)) return { valid: false, reason: "GSTIN format is invalid" };

  const state = STATE_CODES[value.slice(0, 2)];
  if (!state) return { valid: false, reason: `Unknown state code "${value.slice(0, 2)}"` };

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = CHECKSUM_ALPHABET.indexOf(value[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expected = CHECKSUM_ALPHABET[(36 - (sum % 36)) % 36];
  if (expected !== value[14]) return { valid: false, reason: "Checksum digit does not match" };

  return { valid: true, state };
}

/** TDS sections a freelancer or small business actually meets. */
export const TDS_SECTIONS = {
  "194J": { label: "Professional / technical fees", rate: 10, annualThreshold: 3000000 },
  "194C_individual": { label: "Contractor (individual/HUF)", rate: 1, annualThreshold: 10000000 },
  "194C_other": { label: "Contractor (other than individual/HUF)", rate: 2, annualThreshold: 10000000 },
  "194H": { label: "Commission or brokerage", rate: 2, annualThreshold: 2000000 },
  "194I_b": { label: "Rent — land, building, furniture", rate: 10, annualThreshold: 24000000 },
} as const;

export type TdsSection = keyof typeof TDS_SECTIONS;

/**
 * TDS is deducted on the taxable value, never on the GST component
 * (CBDT Circular 23/2017), and only once the annual threshold is crossed.
 */
export function computeTds(args: {
  taxableValuePaise: Paise;
  section: TdsSection;
  paidToDatePaise?: Paise;
  hasPan?: boolean;
}): { tdsPaise: Paise; rate: number; netPayablePaise: Paise; thresholdMet: boolean } {
  const config = TDS_SECTIONS[args.section];
  const cumulative = (args.paidToDatePaise ?? 0) + args.taxableValuePaise;
  const thresholdMet = cumulative > config.annualThreshold;

  // Section 206AA: no PAN means a flat 20% floor.
  const rate = args.hasPan === false ? Math.max(20, config.rate) : config.rate;
  const tds = thresholdMet ? Math.round((args.taxableValuePaise * rate) / 100) : 0;

  return {
    tdsPaise: tds,
    rate,
    netPayablePaise: args.taxableValuePaise - tds,
    thresholdMet,
  };
}
