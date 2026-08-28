"use client";
import { useState } from "react";

export default function Checkout() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(planCode: "pro_monthly" | "pro_yearly") {
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
      // Razorpay's hosted page handles the card entirely — no PCI scope here.
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
          onClick={() => start("pro_monthly")}>
          {busy ? "Starting…" : "Subscribe — ₹399/month"}
        </button>{" "}
        <button className="btn secondary" disabled={busy || !email.includes("@")}
          onClick={() => start("pro_yearly")}>
          Pay yearly
        </button>
      </p>
      {error && <p style={{ color: "#c0392b", marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
