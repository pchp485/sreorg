"use client";
import { useMemo, useState } from "react";
import { validateGstin } from "@/lib/gst";

export default function GstinValidator() {
  const [value, setValue] = useState("");
  const result = useMemo(() => (value.trim() ? validateGstin(value) : null), [value]);

  return (
    <div className="card">
      <label htmlFor="gstin">GSTIN</label>
      <input id="gstin" placeholder="29AAAAA0000A1Z5" autoCapitalize="characters"
        value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} />

      {result && (
        <p style={{ marginBottom: 0, color: result.valid ? "var(--ok)" : "#c0392b" }}>
          {result.valid
            ? `Valid GSTIN — registered in ${result.state}.`
            : `Not valid: ${result.reason}.`}
        </p>
      )}
      {result?.valid && (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 0 }}>
          If your own registration is also in {result.state}, charge CGST + SGST. Otherwise charge IGST.
        </p>
      )}
    </div>
  );
}
