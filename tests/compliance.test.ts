import { describe, expect, it } from "vitest";
import { obligationsForMonth, obligationsDueBetween, type ComplianceProfile } from "@sreorg/tax-india";

const base: ComplianceProfile = {
  entityType: "proprietor",
  gstRegistered: true,
  gstScheme: "monthly",
  deductsTds: false,
  hasEmployees: false,
  stateCode: "29",
};

const codes = (profile: ComplianceProfile, year: number, month: number) =>
  obligationsForMonth(profile, year, month).map((o) => o.code);

describe("GST obligations", () => {
  it("puts GSTR-1 on the 11th and GSTR-3B on the 20th for monthly filers", () => {
    const found = obligationsForMonth(base, 2026, 8); // September 2026
    expect(found.find((o) => o.code === "gstr1")!.dueDate.getUTCDate()).toBe(11);
    expect(found.find((o) => o.code === "gstr3b")!.dueDate.getUTCDate()).toBe(20);
  });

  it("lists nothing GST-related for an unregistered business", () => {
    const result = codes({ ...base, gstRegistered: false }, 2026, 8);
    expect(result.filter((c) => c.startsWith("gst"))).toHaveLength(0);
  });

  it("files QRMP quarterly, and only in the month after a quarter ends", () => {
    const qrmp = { ...base, gstScheme: "qrmp" as const };
    expect(codes(qrmp, 2026, 6)).toContain("gstr3b_qrmp");  // July, after Q1
    expect(codes(qrmp, 2026, 7)).not.toContain("gstr3b_qrmp"); // August, mid-quarter
  });

  it("staggers the QRMP due date by state group", () => {
    const karnataka = obligationsForMonth({ ...base, gstScheme: "qrmp", stateCode: "29" }, 2026, 6);
    const delhi = obligationsForMonth({ ...base, gstScheme: "qrmp", stateCode: "07" }, 2026, 6);
    expect(karnataka.find((o) => o.code === "gstr3b_qrmp")!.dueDate.getUTCDate()).toBe(22);
    expect(delhi.find((o) => o.code === "gstr3b_qrmp")!.dueDate.getUTCDate()).toBe(24);
  });
});

describe("TDS obligations", () => {
  const tds = { ...base, deductsTds: true };

  it("falls due on the 7th of the following month", () => {
    const found = obligationsForMonth(tds, 2026, 8);
    expect(found.find((o) => o.code === "tds_payment")!.dueDate.getUTCDate()).toBe(7);
  });

  it("gives March until 30 April rather than 7 April", () => {
    const april = obligationsForMonth(tds, 2026, 3);
    const payment = april.find((o) => o.code === "tds_payment")!;
    expect(payment.dueDate.getUTCMonth()).toBe(3);
    expect(payment.dueDate.getUTCDate()).toBe(30);
  });

  it("adds the quarterly return in July, October, January and May only", () => {
    for (const month of [6, 9, 0, 4]) expect(codes(tds, 2026, month)).toContain("tds_return");
    for (const month of [1, 5, 7, 11]) expect(codes(tds, 2026, month)).not.toContain("tds_return");
  });
});

describe("payroll and company obligations", () => {
  it("lists PF and ESI only when there are employees", () => {
    expect(codes({ ...base, hasEmployees: true }, 2026, 8)).toContain("pf_esi");
    expect(codes(base, 2026, 8)).not.toContain("pf_esi");
  });

  it("lists ROC filings only for a private limited company", () => {
    expect(codes({ ...base, entityType: "private_limited" }, 2026, 9)).toContain("aoc4");
    expect(codes(base, 2026, 9)).not.toContain("aoc4");
  });

  it("lists advance tax in exactly four months of the year", () => {
    const months = [];
    for (let m = 0; m < 12; m++) if (codes(base, 2026, m).includes("advance_tax")) months.push(m);
    expect(months).toEqual([2, 5, 8, 11]);
  });
});

describe("date windows", () => {
  it("returns obligations in chronological order", () => {
    const found = obligationsForMonth({ ...base, deductsTds: true, hasEmployees: true }, 2026, 8);
    const times = found.map((o) => o.dueDate.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("spans month boundaries without duplicating or dropping anything", () => {
    const from = new Date(Date.UTC(2026, 8, 15));
    const to = new Date(Date.UTC(2026, 10, 15));
    const found = obligationsDueBetween(base, from, to);

    expect(found.length).toBeGreaterThan(0);
    for (const o of found) {
      expect(o.dueDate.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(o.dueDate.getTime()).toBeLessThanOrEqual(to.getTime());
    }
    const keys = found.map((o) => `${o.code}-${o.dueDate.toISOString()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every obligation a penalty, since that is why anyone pays for reminders", () => {
    const all = obligationsDueBetween(
      { ...base, deductsTds: true, hasEmployees: true, entityType: "private_limited" },
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 11, 31)),
    );
    for (const o of all) expect(o.penalty.length).toBeGreaterThan(10);
  });
});
