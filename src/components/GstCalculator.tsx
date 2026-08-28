"use client";
import { useMemo, useState } from "react";
import { computeGst, GST_RATES, type GstRate } from "@/lib/gst";
import { formatINR, rupeesToPaise } from "@/lib/money";

export default function GstCalculator() {
  const [amount, setAmount] = useState("10000");
  const [rate, setRate] = useState<GstRate>(18);
  const [inclusive, setInclusive] = useState(false);
  const [intra, setIntra] = useState(true);

  const result = useMemo(() => {
    const entered = rupeesToPaise(Number(amount) || 0);
    // For an inclusive amount, back out the base: base = gross * 100 / (100 + rate).
    const base = inclusive ? Math.round((entered * 100) / (100 + rate)) : entered;

    return computeGst(
      [{ description: "Amount", hsnSac: "", quantity: 1, unitPricePaise: base, gstRate: rate }],
      "29",
      intra ? "29" : "27",
    );
  }, [amount, rate, inclusive, intra]);

  return (
    <div className="card">
      <div className="grid">
        <div>
          <label htmlFor="amt">Amount (₹)</label>
          <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rate">GST rate</label>
          <select id="rate" value={rate} onChange={(e) => setRate(Number(e.target.value) as GstRate)}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
      </div>

      <p style={{ marginTop: 14 }}>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} />
          Amount already includes GST
        </label>
      </p>
      <p>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={intra} onChange={(e) => setIntra(e.target.checked)} />
          Same state as the client (CGST + SGST). Uncheck for inter-state IGST.
        </label>
      </p>

      <div className="scroll">
        <table>
          <tbody>
            <tr><td>Taxable value</td><td className="num">{formatINR(result.subtotalPaise)}</td></tr>
            {intra ? (
              <>
                <tr><td>CGST @ {rate / 2}%</td><td className="num">{formatINR(result.cgstPaise)}</td></tr>
                <tr><td>SGST @ {rate / 2}%</td><td className="num">{formatINR(result.sgstPaise)}</td></tr>
              </>
            ) : (
              <tr><td>IGST @ {rate}%</td><td className="num">{formatINR(result.igstPaise)}</td></tr>
            )}
            {result.roundOffPaise !== 0 && (
              <tr><td>Round off (Sec 170)</td><td className="num">{formatINR(result.roundOffPaise)}</td></tr>
            )}
            <tr><td><strong>Total</strong></td>
              <td className="num"><strong>{formatINR(result.totalPaise)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
