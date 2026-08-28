"use client";
import { useMemo, useState } from "react";
import { computeGst, GST_RATES, STATE_CODES, type GstRate, type LineItem } from "@sreorg/tax-india";
import { formatINR, rupeesToPaise } from "@sreorg/core/money";

interface Row { description: string; hsnSac: string; quantity: string; rate: string; gstRate: GstRate; }

const BLANK: Row = { description: "", hsnSac: "998314", quantity: "1", rate: "", gstRate: 18 };

export default function InvoiceGenerator({ defaultSac = "998314", defaultRate = 18 as GstRate }) {
  const [supplierState, setSupplierState] = useState("29");
  const [placeOfSupply, setPlaceOfSupply] = useState("29");
  const [rows, setRows] = useState<Row[]>([{ ...BLANK, hsnSac: defaultSac, gstRate: defaultRate }]);

  const items: LineItem[] = useMemo(
    () => rows
      .filter((r) => Number(r.rate) > 0)
      .map((r) => ({
        description: r.description || "Professional services",
        hsnSac: r.hsnSac,
        quantity: Number(r.quantity) || 0,
        unitPricePaise: rupeesToPaise(Number(r.rate) || 0),
        gstRate: r.gstRate,
      })),
    [rows],
  );

  const totals = useMemo(
    () => computeGst(items, supplierState, placeOfSupply),
    [items, supplierState, placeOfSupply],
  );

  const intra = supplierState === placeOfSupply;

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="card">
      <div className="grid">
        <div>
          <label htmlFor="ss">Your state (from your GSTIN)</label>
          <select id="ss" value={supplierState} onChange={(e) => setSupplierState(e.target.value)}>
            {Object.entries(STATE_CODES).map(([code, name]) => (
              <option key={code} value={code}>{code} — {name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pos">Place of supply (your client&apos;s state)</label>
          <select id="pos" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
            {Object.entries(STATE_CODES).map(([code, name]) => (
              <option key={code} value={code}>{code} — {name}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="pill" style={{ marginTop: 14 }}>
        {intra ? "Intra-state supply → CGST + SGST" : "Inter-state supply → IGST"}
      </p>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Description</th><th>SAC/HSN</th><th className="num">Qty</th>
              <th className="num">Rate (₹)</th><th className="num">GST</th><th className="num">Taxable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td><input value={row.description} placeholder="Design retainer — March"
                  onChange={(e) => update(i, { description: e.target.value })} /></td>
                <td><input value={row.hsnSac} onChange={(e) => update(i, { hsnSac: e.target.value })} /></td>
                <td><input className="num" inputMode="decimal" value={row.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })} /></td>
                <td><input inputMode="decimal" value={row.rate} placeholder="0"
                  onChange={(e) => update(i, { rate: e.target.value })} /></td>
                <td>
                  <select value={row.gstRate}
                    onChange={(e) => update(i, { gstRate: Number(e.target.value) as GstRate })}>
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </td>
                <td className="num">
                  {formatINR(rupeesToPaise((Number(row.rate) || 0) * (Number(row.quantity) || 0)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        <button className="btn secondary" type="button"
          onClick={() => setRows((r) => [...r, { ...BLANK, hsnSac: defaultSac, gstRate: defaultRate }])}>
          Add line
        </button>
      </p>

      <div className="scroll">
        <table>
          <tbody>
            <tr><td>Taxable value</td><td className="num">{formatINR(totals.subtotalPaise)}</td></tr>
            {intra ? (
              <>
                <tr><td>CGST</td><td className="num">{formatINR(totals.cgstPaise)}</td></tr>
                <tr><td>SGST</td><td className="num">{formatINR(totals.sgstPaise)}</td></tr>
              </>
            ) : (
              <tr><td>IGST</td><td className="num">{formatINR(totals.igstPaise)}</td></tr>
            )}
            {totals.roundOffPaise !== 0 && (
              <tr><td>Round off</td><td className="num">{formatINR(totals.roundOffPaise)}</td></tr>
            )}
            <tr><td><strong>Invoice total</strong></td>
              <td className="num"><strong>{formatINR(totals.totalPaise)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
