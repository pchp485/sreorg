"use client";
import { useState } from "react";

export interface CheckoutProps {
  monthlyPlanCode: string;
  yearlyPlanCode?: string;
  monthlyLabel: string;
  yearlyLabel?: string;
}

/**
 * One checkout component for every product in the portfolio. It posts a plan
 * code; the shared handler resolves which product that is. Razorpay's hosted
 * page takes the card, so nothing here is in PCI scope.
 */
export default function Checkout({ monthlyPlanCode, yearlyPlanCode, monthlyLabel, yearlyLabel }: CheckoutProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(planCode: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, planCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div style={{ margin: "14px 0" }}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" placeholder="you@example.com" value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <p style={{ margin: "10px 0 0" }}>
        <button className="btn" disabled={busy || !email.includes("@")}
          onClick={() => start(monthlyPlanCode)}>
          {busy ? "Starting…" : monthlyLabel}
        </button>{" "}
        {yearlyPlanCode && (
          <button className="btn secondary" disabled={busy || !email.includes("@")}
            onClick={() => start(yearlyPlanCode)}>
            {yearlyLabel ?? "Pay yearly"}
          </button>
        )}
      </p>
      {error && <p style={{ color: "#c0392b", marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
