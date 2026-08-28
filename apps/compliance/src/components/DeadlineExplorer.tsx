"use client";
import { useMemo, useState } from "react";
import { obligationsDueBetween, type ComplianceProfile, type EntityType } from "@sreorg/tax-india";
import { STATE_CODES } from "@sreorg/tax-india";

const DAY = 86_400_000;

export default function DeadlineExplorer(props: Partial<ComplianceProfile> = {}) {
  const [entityType, setEntityType] = useState<EntityType>(props.entityType ?? "proprietor");
  const [gstRegistered, setGstRegistered] = useState(props.gstRegistered ?? true);
  const [gstScheme, setGstScheme] = useState<"monthly" | "qrmp">(props.gstScheme ?? "monthly");
  const [deductsTds, setDeductsTds] = useState(props.deductsTds ?? false);
  const [hasEmployees, setHasEmployees] = useState(props.hasEmployees ?? false);
  const [stateCode, setStateCode] = useState(props.stateCode ?? "29");

  const upcoming = useMemo(() => {
    const now = new Date();
    return obligationsDueBetween(
      { entityType, gstRegistered, gstScheme, deductsTds, hasEmployees, stateCode },
      now,
      new Date(now.getTime() + 120 * DAY),
    );
  }, [entityType, gstRegistered, gstScheme, deductsTds, hasEmployees, stateCode]);

  return (
    <div className="card">
      <div className="grid">
        <div>
          <label htmlFor="entity">Entity type</label>
          <select id="entity" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
            <option value="proprietor">Proprietorship / freelancer</option>
            <option value="llp">LLP</option>
            <option value="private_limited">Private limited</option>
          </select>
        </div>
        <div>
          <label htmlFor="scheme">GST filing</label>
          <select id="scheme" value={gstScheme} onChange={(e) => setGstScheme(e.target.value as "monthly" | "qrmp")}>
            <option value="monthly">Monthly</option>
            <option value="qrmp">QRMP (quarterly)</option>
          </select>
        </div>
        <div>
          <label htmlFor="st">State</label>
          <select id="st" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
            {Object.entries(STATE_CODES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ marginTop: 14, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={gstRegistered} onChange={(e) => setGstRegistered(e.target.checked)} />
          GST registered
        </label>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={deductsTds} onChange={(e) => setDeductsTds(e.target.checked)} />
          I deduct TDS
        </label>
        <label style={{ display: "inline" }}>
          <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
            checked={hasEmployees} onChange={(e) => setHasEmployees(e.target.checked)} />
          I have employees
        </label>
      </p>

      {upcoming.length === 0 ? (
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          Nothing due in the next four months for this profile.
        </p>
      ) : (
        <div className="scroll">
          <table>
            <thead><tr><th>Due</th><th>Obligation</th><th>Miss it and…</th></tr></thead>
            <tbody>
              {upcoming.map((o) => (
                <tr key={`${o.code}-${o.dueDate.toISOString()}`}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {o.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                  </td>
                  <td>{o.label}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{o.penalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
