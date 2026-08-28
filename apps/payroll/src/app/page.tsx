import Link from "next/link";
import SalaryCalculator from "../components/SalaryCalculator";

export default function Home() {
  return (
    <>
      <h1>What actually reaches the bank account.</h1>
      <p className="lede">
        Free in-hand salary calculator with PF, ESI, professional tax and TDS worked out
        properly — including the employer contributions that sit inside CTC and never reach
        the employee.
      </p>

      <SalaryCalculator />

      <h2>Why CTC and take-home differ so much</h2>
      <p>
        CTC includes what the employer pays on your behalf: their 12% provident fund
        contribution and the gratuity provision. Neither is part of your gross salary, so a
        calculator that treats CTC as gross overstates every figure below it. This one does
        not.
      </p>

      <div className="card" style={{ marginTop: 24 }}>
        <strong>Running payroll for a few people?</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          Pro generates and emails every payslip on the 1st of the month, with PF, ESI, PT
          and TDS already computed. ₹499/month, whatever your headcount.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>
    </>
  );
}
