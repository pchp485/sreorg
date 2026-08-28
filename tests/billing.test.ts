import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, PLANS } from "@/lib/razorpay";
import { nextStep } from "../scripts/dunning-engine";

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

describe("pricing", () => {
  it("prices yearly at ten months of monthly", () => {
    expect(PLANS.pro_yearly.amountPaise).toBe(PLANS.pro_monthly.amountPaise * 10);
  });

  it("needs 76 subscribers to clear ₹30,000 MRR", () => {
    expect(Math.ceil(3_000_000 / PLANS.pro_monthly.amountPaise)).toBe(76);
  });
});
