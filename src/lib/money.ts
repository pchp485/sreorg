/**
 * All money is integer paise. Never floats — 0.1 + 0.2 problems become
 * rupee-level invoice disputes, and GST returns must reconcile to the paisa.
 */
export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Indian digit grouping: 12,34,567.89 */
export function formatINR(paise: Paise): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");

  const s = String(rupees);
  let grouped: string;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${negative ? "-" : ""}₹${grouped}.${cents}`;
}

/**
 * Section 170 of the CGST Act: the tax payable on an invoice is rounded to the
 * nearest rupee. Half rounds up.
 */
export function roundToNearestRupee(paise: Paise): Paise {
  return Math.round(paise / 100) * 100;
}
