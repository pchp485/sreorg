import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, PRODUCTS, monthlyEquivalentPaise } from "@sreorg/core";
import { nextStep } from "../apps/invoicing/scripts/dunning-engine";

const SECRET = "whsec_test_secret";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

describe("razorpay webhook signature", () => {
  const body = JSON.stringify({ event: "subscription.activated", payload: {} });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyWebhookSignature(body + " ", sign(body), SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const wrong = createHmac("sha256", "other").update(body).digest("hex");
    expect(verifyWebhookSignature(body, wrong, SECRET)).toBe(false);
  });

  it("rejects an empty signature or an unset secret", () => {
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyWebhookSignature(body, "abc123", SECRET)).toBe(false);
  });
});

describe("dunning schedule", () => {
  it("stays silent before the first milestone", () => {
    expect(nextStep(1, 0)).toBeNull();
    expect(nextStep(2, 0)).toBeNull();
  });

  it("fires each milestone exactly once", () => {
    expect(nextStep(3, 0)).toBe(0);
    expect(nextStep(5, 1)).toBeNull();
    expect(nextStep(7, 1)).toBe(1);
    expect(nextStep(14, 2)).toBe(2);
    expect(nextStep(30, 3)).toBe(3);
  });

  it("stops after the last milestone instead of nagging forever", () => {
    expect(nextStep(90, 4)).toBeNull();
    expect(nextStep(400, 4)).toBeNull();
  });

  it("does not skip a milestone when a run is missed", () => {
    // Cron did not run for a week; the invoice is 10 days overdue with 0 sent.
    expect(nextStep(10, 0)).toBe(0);
  });
});

describe("portfolio pricing", () => {
  it("prices every yearly plan at ten months of its monthly plan", () => {
    for (const product of Object.values(PRODUCTS)) {
      const [monthly, yearly] = product.plans;
      expect(yearly.amountPaise).toBe(monthly.amountPaise * 10);
    }
  });

  it("normalises yearly plans into a comparable monthly figure", () => {
    const [monthly, yearly] = PRODUCTS.invoicing.plans;
    expect(monthlyEquivalentPaise(monthly)).toBe(monthly.amountPaise);
    // Ten months of price spread over twelve months of service.
    expect(monthlyEquivalentPaise(yearly)).toBe(Math.round(monthly.amountPaise * 10 / 12));
  });

  it("needs 76 invoicing subscribers, or 61 payroll ones, to clear ₹30,000 MRR", () => {
    expect(Math.ceil(3_000_000 / PRODUCTS.invoicing.plans[0].amountPaise)).toBe(76);
    expect(Math.ceil(3_000_000 / PRODUCTS.payroll.plans[0].amountPaise)).toBe(61);
  });

  it("gives every plan a distinct code, so a webhook can never credit the wrong product", () => {
    const codes = Object.values(PRODUCTS).flatMap((p) => p.plans.map((pl) => pl.code));
    expect(new Set(codes).size).toBe(codes.length);
  });
});
