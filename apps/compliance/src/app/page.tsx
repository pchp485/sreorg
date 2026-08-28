import Link from "next/link";
import DeadlineExplorer from "../components/DeadlineExplorer";

export default function Home() {
  return (
    <>
      <h1>What&apos;s due, and what missing it costs.</h1>
      <p className="lede">
        GST, TDS, PF, ESI, advance tax and ROC deadlines for the next four months. Tick what
        applies to you. No signup.
      </p>

      <DeadlineExplorer />

      <div className="card" style={{ marginTop: 24 }}>
        <strong>Knowing the date is not the problem. Remembering it is.</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          ₹199/month emails you a week before each deadline that actually applies to your
          business. One missed GSTR-3B costs more than a year of this.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>

      <h2>A note on extensions</h2>
      <p>
        The dates here are the statutory ones. The government extends them by notification
        several times a year, and no calendar can know that in advance — so a reminder based
        on the statutory date is early, never late.
      </p>
    </>
  );
}
