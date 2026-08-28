import Link from "next/link";
import { TOOLS } from "@/content/tools";
import { PROFESSIONS } from "@/content/pseo";

export default function Home() {
  return (
    <>
      <h1>Your invoices should chase payment while you sleep.</h1>
      <p className="lede">
        Free GST tools for Indian freelancers and small businesses. When you are ready,
        ₹399/month puts every overdue invoice on an automatic follow-up schedule —
        polite, timed, and relentless in a way you will never be.
      </p>

      <p>
        <Link className="btn" href="/tools/invoice-generator">Make an invoice free</Link>{" "}
        <Link className="btn secondary" href="/pricing">See pricing</Link>
      </p>

      <h2>Free tools, no signup</h2>
      <div className="grid">
        {TOOLS.map((tool) => (
          <div className="card" key={tool.slug}>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>
              <Link href={`/tools/${tool.slug}`}>{tool.name}</Link>
            </h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem" }}>{tool.headline}</p>
          </div>
        ))}
      </div>

      <h2>Invoice formats by profession</h2>
      <p style={{ color: "var(--muted)" }}>
        Correct SAC code, correct GST slab, and the TDS section your client will deduct under.
      </p>
      <ul>
        {PROFESSIONS.map((p) => (
          <li key={p.slug}>
            <Link href={`/invoice/${p.slug}/karnataka`}>{p.label}</Link>{" "}
            <span className="pill">SAC {p.sac}</span>
          </li>
        ))}
      </ul>

      <h2>Why the paid tier exists</h2>
      <p>
        The average Indian freelancer waits 45+ days to be paid, and most of that delay is
        simply nobody following up. Chasing is unpleasant, so it does not happen. A machine
        does not find it unpleasant. That is the whole product.
      </p>
    </>
  );
}
