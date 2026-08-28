"use client";
import { useMemo, useState } from "react";
import { computeTds, TDS_SECTIONS, type TdsSection } from "@/lib/gst";
import { formatINR, rupeesToPaise } from "@/lib/money";

export default function TdsCalculator() {
  const [amount, setAmount] = useState("100000");
  const [section, setSection] = useState<TdsSection>("194J");
  const [paidToDate, setPaidToDate] = useState("0");
  const [hasPan, setHasPan] = useState(true);

  const result = useMemo(
    () => computeTds({
      taxableValuePaise: rupeesToPaise(Number(amount) || 0),
      section,
      paidToDatePaise: rupeesToPaise(Number(paidToDate) || 0),
      hasPan,
    }),
    [amount, section, paidToDate, hasPan],
  );

  return (
    <div className="card">
      <div className="grid">
        <div>
          <label htmlFor="tamt">Invoice value before GST (₹)</label>
          <input id="tamt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sec">Section</label>
          <select id="sec" value={section} onChange={(e) => setSection(e.target.value as TdsSection)}>
            {Object.entries(TDS_SECTIONS).map(([key, cfg]) => (
              <option key={key} value={key}>{key.split("_")[0]} — {cfg.label} ({cfg.rate}%)</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ptd">Already paid to you this financial year (₹)</label>
          <input id="ptd" inputMode="decimal" value={paidToDate} onChange={(e) => setPaidToDate(e.target.value)} />
        </div>
      </div>

      <p style={{ marginTop: 14 }}>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={hasPan} onChange={(e) => setHasPan(e.target.checked)} />
          PAN provided to the client (unchecked applies the 20% floor under Sec 206AA)
        </label>
      </p>

      <div className="scroll">
        <table>
          <tbody>
            <tr><td>TDS rate applied</td><td className="num">{result.rate}%</td></tr>
            <tr><td>Annual threshold crossed</td><td className="num">{result.thresholdMet ? "Yes" : "No — no TDS yet"}</td></tr>
            <tr><td>TDS deducted</td><td className="num">{formatINR(result.tdsPaise)}</td></tr>
            <tr><td><strong>You receive (before GST)</strong></td>
              <td className="num"><strong>{formatINR(result.netPayablePaise)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 0 }}>
        TDS is deducted on the taxable value only, never on the GST component (CBDT Circular 23/2017).
        Your client pays you the GST in full and deposits the TDS against your PAN.
      </p>
    </div>
  );
}
