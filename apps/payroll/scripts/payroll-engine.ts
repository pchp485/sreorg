/**
 * The payroll product loop. Runs on the 1st of every month; generates and emails
 * a payslip for every employee of every paying customer.
 *
 * This is the whole subscription: the work happens whether or not the customer
 * remembers it is the 1st.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema, sendEmail, layout, formatINR, track, payingUserIds } from "@sreorg/core";
import { buildPayslip, type Regime } from "@sreorg/tax-india";

/** "2026-08" — the payroll month, used as the idempotency key per employee. */
export function periodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function runPayroll(now = new Date()): Promise<{ generated: number; skipped: number }> {
  const payingUsers = await payingUserIds("payroll");
  if (payingUsers.length === 0) return { generated: 0, skipped: 0 };

  // Payslips issued on the 1st cover the month that just ended.
  const covered = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period = periodKey(covered);

  const staff = await db
    .select({
      id: schema.employees.id,
      userId: schema.employees.userId,
      name: schema.employees.name,
      email: schema.employees.email,
      ctcPaise: schema.employees.ctcPaise,
      basicPercent: schema.employees.basicPercent,
      stateCode: schema.employees.stateCode,
      regime: schema.employees.regime,
      pfOptedIn: schema.employees.pfOptedIn,
      employerName: schema.users.businessName,
      employerEmail: schema.users.email,
    })
    .from(schema.employees)
    .innerJoin(schema.users, eq(schema.users.id, schema.employees.userId))
    .where(and(
      eq(schema.employees.active, true),
      inArray(schema.employees.userId, payingUsers),
    ));

  let generated = 0;
  let skipped = 0;

  for (const employee of staff) {
    const slip = buildPayslip({
      ctcPaise: employee.ctcPaise,
      basicPercent: employee.basicPercent,
      stateCode: employee.stateCode,
      regime: employee.regime as Regime,
      pfOptedIn: employee.pfOptedIn,
      month: covered.getUTCMonth() + 1,
    });

    // The unique index on (employee, period) makes a re-run a no-op rather than
    // a second payslip — a cron that fires twice must not pay anyone twice.
    const inserted = await db
      .insert(schema.payslips)
      .values({
        userId: employee.userId,
        employeeId: employee.id,
        period,
        breakdown: slip,
        grossPaise: slip.earnings.grossPaise,
        deductionsPaise: slip.deductions.totalPaise,
        netPaise: slip.netPayPaise,
      })
      .onConflictDoNothing()
      .returning({ id: schema.payslips.id });

    if (inserted.length === 0) { skipped++; continue; }

    const sent = await sendEmail({
      to: employee.email,
      replyTo: employee.employerEmail,
      subject: `Payslip for ${period}`,
      html: layout(`<h2>Payslip — ${period}</h2>
<p>Hi ${employee.name}, here is your payslip from ${employee.employerName ?? "your employer"}.</p>
<table style="width:100%;font-size:15px;border-collapse:collapse">
  <tr><td style="padding:6px 0">Basic</td><td align="right">${formatINR(slip.earnings.basic)}</td></tr>
  <tr><td style="padding:6px 0">HRA</td><td align="right">${formatINR(slip.earnings.hra)}</td></tr>
  <tr><td style="padding:6px 0">Special allowance</td><td align="right">${formatINR(slip.earnings.specialAllowance)}</td></tr>
  <tr><td style="padding:6px 0;border-top:1px solid #ddd"><strong>Gross</strong></td>
      <td align="right" style="border-top:1px solid #ddd"><strong>${formatINR(slip.earnings.grossPaise)}</strong></td></tr>
  <tr><td style="padding:6px 0">Provident fund</td><td align="right">−${formatINR(slip.deductions.epfEmployee)}</td></tr>
  ${slip.deductions.esiEmployee > 0 ? `<tr><td style="padding:6px 0">ESI</td><td align="right">−${formatINR(slip.deductions.esiEmployee)}</td></tr>` : ""}
  <tr><td style="padding:6px 0">Professional tax</td><td align="right">−${formatINR(slip.deductions.professionalTax)}</td></tr>
  <tr><td style="padding:6px 0">TDS</td><td align="right">−${formatINR(slip.deductions.tds)}</td></tr>
  <tr><td style="padding:6px 0;border-top:1px solid #ddd"><strong>Net pay</strong></td>
      <td align="right" style="border-top:1px solid #ddd"><strong>${formatINR(slip.netPayPaise)}</strong></td></tr>
</table>
<p style="color:#666;font-size:13px">Questions about this payslip go to ${employee.employerEmail}.</p>`),
    });

    if (sent) {
      await db.update(schema.payslips)
        .set({ sentAt: new Date() })
        .where(eq(schema.payslips.id, inserted[0].id));
    }

    if (slip.warnings.length > 0) {
      await sendEmail({
        to: employee.employerEmail,
        subject: `Check the payslip for ${employee.name}`,
        html: layout(`<p>${period} payslip generated with warnings:</p>
<ul>${slip.warnings.map((w) => `<li>${w}</li>`).join("")}</ul>`),
      });
    }

    await track({ product: "payroll", name: "automation_ran", userId: employee.userId, meta: { kind: "payslip", period } });
    generated++;
  }

  return { generated, skipped };
}

if (process.argv[1]?.endsWith("payroll-engine.ts")) {
  runPayroll()
    .then((r) => { console.log(`[payroll] generated=${r.generated} skipped=${r.skipped}`); process.exit(0); })
    .catch((err) => { console.error("[payroll] failed", err); process.exit(1); });
}
