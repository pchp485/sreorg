import type { Metadata } from "next";
import { PRODUCTS, formatINR } from "@sreorg/core";
import { Checkout } from "@sreorg/ui";

export const metadata: Metadata = {
  title: "Pricing — ₹199/month",
  description: "The calendar is free. ₹199/month to be told a week before each deadline that applies to you.",
};

const [MONTHLY, YEARLY] = PRODUCTS.compliance.plans;

export default function PricingPage() {
  return (
    <>
      <h1>₹199/month to never pay a late fee again.</h1>
      <p className="lede">
        One missed GSTR-3B is ₹50 a day plus 18% interest. The maths is not subtle.
      </p>

      <div className="grid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>₹0</p>
          <ul>
            <li>Full deadline calendar</li>
            <li>Filter by entity type and scheme</li>
            <li>Penalty for each obligation</li>
            <li>You remember it yourself</li>
          </ul>
        </div>

        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2 style={{ marginTop: 0 }}>Reminders</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>
            {formatINR(MONTHLY.amountPaise)}
            <span style={{ fontSize: "1rem", color: "var(--muted)" }}>/month</span>
          </p>
          <ul>
            <li><strong>Email a week before every deadline</strong></li>
            <li>Only the obligations that apply to you</li>
            <li>Each reminder sent exactly once</li>
            <li>Adjustable lead time</li>
          </ul>
          <Checkout monthlyPlanCode={MONTHLY.code} yearlyPlanCode={YEARLY.code}
            monthlyLabel="Subscribe — ₹199/month" yearlyLabel="Pay yearly" />
        </div>
      </div>
    </>
  );
}
