import { describe, expect, it } from "vitest";
import { assess } from "../scripts/portfolio-report";
import type { ProductMetrics } from "@sreorg/core";

const metrics = (over: Partial<ProductMetrics> = {}): ProductMetrics => ({
  product: "invoicing",
  activeSubs: 0,
  mrrPaise: 0,
  views30d: 0,
  signups30d: 0,
  newSubs30d: 0,
  cancelled30d: 0,
  churnPercent: 0,
  ageDays: 0,
  ...over,
});

describe("kill criteria", () => {
  it("judges nothing inside the grace period, however bad it looks", () => {
    const result = assess(metrics({ ageDays: 45, views30d: 0, mrrPaise: 0 }));
    expect(result.verdict).toBe("HOLD");
  });

  it("kills a product that is old, earning nothing and gaining nobody", () => {
    const result = assess(metrics({ ageDays: 200, mrrPaise: 0, newSubs30d: 0 }));
    expect(result.verdict).toBe("KILL");
  });

  it("spares an old, low-revenue product that is still winning customers", () => {
    const result = assess(metrics({ ageDays: 200, mrrPaise: 39_900, newSubs30d: 1, activeSubs: 1 }));
    expect(result.verdict).toBe("SCALE");
  });

  it("spares an old product that is already above the revenue floor", () => {
    const result = assess(metrics({ ageDays: 300, mrrPaise: 500_000, newSubs30d: 0, activeSubs: 12 }));
    expect(result.verdict).not.toBe("KILL");
  });

  it("calls out traffic that does not convert as a broken offer, not a traffic problem", () => {
    const result = assess(metrics({ ageDays: 120, views30d: 4_000, signups30d: 30, activeSubs: 0 }));
    expect(result.verdict).toBe("FIX");
    expect(result.reason).toMatch(/offer/i);
  });

  it("treats churn as the priority even while new customers arrive", () => {
    const result = assess(metrics({
      ageDays: 200, activeSubs: 10, mrrPaise: 399_000, newSubs30d: 4, cancelled30d: 4, churnPercent: 28.6,
    }));
    expect(result.verdict).toBe("FIX");
    expect(result.reason).toMatch(/churn/i);
  });

  it("scales a product that is growing with tolerable churn", () => {
    const result = assess(metrics({
      ageDays: 150, activeSubs: 20, mrrPaise: 798_000, newSubs30d: 6, churnPercent: 5,
    }));
    expect(result.verdict).toBe("SCALE");
  });
});

describe("distance to target", () => {
  it("counts the subscribers still needed at that product's own price", () => {
    expect(assess(metrics({ product: "invoicing" })).subsToTarget).toBe(76);
    expect(assess(metrics({ product: "payroll" })).subsToTarget).toBe(61);
    expect(assess(metrics({ product: "compliance" })).subsToTarget).toBe(151);
  });

  it("nets off revenue already earned", () => {
    const result = assess(metrics({ product: "invoicing", mrrPaise: 1_500_000 }));
    expect(result.subsToTarget).toBe(38);
  });

  it("reports zero once the product carries the target alone", () => {
    expect(assess(metrics({ mrrPaise: 3_500_000 })).subsToTarget).toBe(0);
  });
});
