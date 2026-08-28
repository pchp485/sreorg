"use client";
import { useMemo, useState } from "react";
import { buildPayslip, STATE_CODES, type Regime } from "@sreorg/tax-india";
import { formatINR, rupeesToPaise } from "@sreorg/core/money";

export default function SalaryCalculator({
  defaultAnnualCtc = 1_200_000,
  defaultState = "29",
}: { defaultAnnualCtc?: number; defaultState?: string }) {
  const [annualCtc, setAnnualCtc] = useState(String(defaultAnnualCtc));
  const [stateCode, setStateCode] = useState(defaultState);
  const [regime, setRegime] = useState<Regime>("new");
  const [basicPercent, setBasicPercent] = useState("50");
  const [pfOptedIn, setPfOptedIn] = useState(true);

  const slip = useMemo(() => buildPayslip({
    ctcPaise: Math.round(rupeesToPaise(Number(annualCtc) || 0) / 12),
    basicPercent: Number(basicPercent) || 50,
    stateCode,
    regime,
    pfOptedIn,
  }), [annualCtc, basicPercent, stateCode, regime, pfOptedIn]);

  return (
    <div className="card">
      <div className="grid">
        <div>
          <label htmlFor="ctc">Annual CTC (₹)</label>
          <input id="ctc" inputMode="decimal" value={annualCtc}
            onChange={(e) => setAnnualCtc(e.target.value)} />
        </div>
        <div>
          <label htmlFor="state">State of employment</label>
          <select id="state" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
            {Object.entries(STATE_CODES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="regime">Tax regime</label>
          <select id="regime" value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
            <option value="new">New regime (default)</option>
            <option value="old">Old regime</option>
          </select>
        </div>
        <div>
          <label htmlFor="basic">Basic as % of CTC</label>
          <input id="basic" inputMode="decimal" value={basicPercent}
            onChange={(e) => setBasicPercent(e.target.value)} />
        </div>
      </div>

      <p style={{ marginTop: 14 }}>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={pfOptedIn} onChange={(e) => setPfOptedIn(e.target.checked)} />
          Provident fund applies
        </label>
      </p>

      <div className="scroll">
        <table>
          <tbody>
            <tr><td>Basic</td><td className="num">{formatINR(slip.earnings.basic)}</td></tr>
            <tr><td>HRA</td><td className="num">{formatINR(slip.earnings.hra)}</td></tr>
            <tr><td>Special allowance</td><td className="num">{formatINR(slip.earnings.specialAllowance)}</td></tr>
            <tr><td><strong>Monthly gross</strong></td>
              <td className="num"><strong>{formatINR(slip.earnings.grossPaise)}</strong></td></tr>
            <tr><td>PF (employee)</td><td className="num">−{formatINR(slip.deductions.epfEmployee)}</td></tr>
            {slip.deductions.esiEmployee > 0 && (
              <tr><td>ESI (employee)</td><td className="num">−{formatINR(slip.deductions.esiEmployee)}</td></tr>
            )}
            <tr>
              <td>Professional tax{!slip.deductions.professionalTaxConfigured && " (not configured)"}</td>
              <td className="num">−{formatINR(slip.deductions.professionalTax)}</td>
            </tr>
            <tr><td>TDS</td><td className="num">−{formatINR(slip.deductions.tds)}</td></tr>
            <tr><td><strong>In hand, per month</strong></td>
              <td className="num"><strong>{formatINR(slip.netPayPaise)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      {slip.warnings.map((w) => (
        <p key={w} style={{ color: "#b26a00", fontSize: "0.9rem", marginBottom: 0 }}>{w}</p>
      ))}
      <p className="pill" style={{ marginTop: 12 }}>Rates: {slip.rateConfig}</p>
    </div>
  );
}
