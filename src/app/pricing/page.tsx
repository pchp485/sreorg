import type { Metadata } from "next";
import { PLANS } from "@/lib/razorpay";
import { formatINR } from "@/lib/money";
import Checkout from "@/components/Checkout";

export const metadata: Metadata = {
  title: "Pricing — ₹399/month, cancel any time",
  description: "Free forever for three invoices a month. ₹399/month for unlimited invoices and automatic follow-up on everything overdue.",
};

export default function PricingPage() {
  return (
    <>
      <h1>One price. Cancel any time.</h1>
      <p className="lede">
        The free tier is genuinely usable. You pay when you want the chasing to happen without you.
      </p>

      <div className="grid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>₹0</p>
          <ul>
            <li>All calculators, no signup</li>
            <li>3 invoices a month</li>
            <li>2 saved clients</li>
            <li>Manual sending</li>
          </ul>
        </div>

        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2 style={{ marginTop: 0 }}>Pro</h2>
          <p style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>
            {formatINR(PLANS.pro_monthly.amountPaise)}<span style={{ fontSize: "1rem", color: "var(--muted)" }}>/month</span>
          </p>
          <ul>
            <li>Unlimited invoices and clients</li>
            <li><strong>Automatic reminders</strong> at day 3, 7, 14 and 30 past due</li>
            <li>Payment link on every invoice</li>
            <li>No branding on what your client sees</li>
          </ul>
          <Checkout />
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 0 }}>
            {formatINR(PLANS.pro_yearly.amountPaise)}/year if you prefer — two months free.
          </p>
        </div>
      </div>

      <h2>Why ₹399</h2>
      <p>
        One invoice paid two weeks sooner is worth more than a year of this. The price is set
        low enough that the decision is not worth thinking about, and high enough that this
        stays a real business rather than a hobby that gets abandoned.
      </p>
    </>
  );
}
