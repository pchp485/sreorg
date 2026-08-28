import type { Metadata } from "next";
import { PRODUCTS, formatINR } from "@sreorg/core";
import { Checkout } from "@sreorg/ui";

export const metadata: Metadata = {
  title: "Pricing — ₹499/month for unlimited payslips",
  description: "Free calculator forever. ₹499/month to have every payslip generated and emailed on the 1st.",
};

const [MONTHLY, YEARLY] = PRODUCTS.payroll.plans;

export default function PricingPage() {
  return (
    <>
      <h1>Flat price, any headcount.</h1>
      <p className="lede">
        Per-employee pricing punishes you for hiring. This does not.
      </p>

      <div className="grid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>₹0</p>
          <ul>
            <li>Salary calculator, no signup</li>
            <li>Up to 2 employees on file</li>
            <li>Generate payslips by hand</li>
          </ul>
        </div>

        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2 style={{ marginTop: 0 }}>Payroll</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>
            {formatINR(MONTHLY.amountPaise)}
            <span style={{ fontSize: "1rem", color: "var(--muted)" }}>/month</span>
          </p>
          <ul>
            <li>Unlimited employees</li>
            <li><strong>Payslips generated and emailed on the 1st</strong></li>
            <li>PF, ESI, professional tax and TDS computed</li>
            <li>Warnings when a state&apos;s rules are not configured</li>
          </ul>
          <Checkout monthlyPlanCode={MONTHLY.code} yearlyPlanCode={YEARLY.code}
            monthlyLabel="Subscribe — ₹499/month" yearlyLabel="Pay yearly" />
        </div>
      </div>

      <h2>What this does not do</h2>
      <p>
        It does not file your returns or make the PF payment for you, and it is not a
        substitute for a payroll consultant once you are past twenty or so people. It removes
        the monthly hour of spreadsheet work, which is the part nobody wants.
      </p>
    </>
  );
}
