/**
 * The invoicing product loop. Runs daily; finds invoices past their due date
 * belonging to paying customers and sends the follow-up the freelancer would
 * not have sent.
 *
 * This is what the subscription buys, and it is why the subscription renews.
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import {
  db, schema, sendEmail, layout, formatINR, track, env, payingUserIds,
} from "@sreorg/core";

/** Days past due at which a reminder goes out. Escalating, never rude. */
const SCHEDULE = [3, 7, 14, 30] as const;

function toneFor(step: number): { subject: string; body: string } {
  switch (step) {
    case 0:
      return {
        subject: "Just checking this landed",
        body: `<p>Hi — a quick nudge that this invoice came due a few days ago. If it is
        already in your payment run, please ignore this.</p>`,
      };
    case 1:
      return {
        subject: "Following up on an unpaid invoice",
        body: `<p>Hi — following up on this one, now a week past due. If something is
        blocking approval on your side, tell me what you need and I will send it across.</p>`,
      };
    case 2:
      return {
        subject: "Invoice now two weeks overdue",
        body: `<p>Hi — this invoice is two weeks past its due date. Could you confirm a
        payment date so I can plan around it?</p>`,
      };
    default:
      return {
        subject: "Invoice 30 days overdue — please advise",
        body: `<p>Hi — this invoice is now thirty days past due. Please let me know when it
        will be settled, or who I should be speaking to instead.</p>`,
      };
  }
}

/** At most one reminder per run, and only once the next milestone is reached. */
export function nextStep(daysOverdue: number, remindersSent: number): number | null {
  if (remindersSent >= SCHEDULE.length) return null;
  return daysOverdue >= SCHEDULE[remindersSent] ? remindersSent : null;
}

export async function runDunning(now = new Date()): Promise<{ sent: number; skipped: number }> {
  // Only paying customers get automation — that is the entitlement boundary.
  const payingUsers = await payingUserIds("invoicing");
  if (payingUsers.length === 0) return { sent: 0, skipped: 0 };

  const due = await db
    .select({
      id: schema.invoices.id,
      number: schema.invoices.number,
      dueDate: schema.invoices.dueDate,
      totalPaise: schema.invoices.totalPaise,
      remindersSent: schema.invoices.remindersSent,
      publicToken: schema.invoices.publicToken,
      clientEmail: schema.clients.email,
      senderName: schema.users.businessName,
      senderEmail: schema.users.email,
    })
    .from(schema.invoices)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.invoices.clientId))
    .innerJoin(schema.users, eq(schema.users.id, schema.invoices.userId))
    .where(and(
      eq(schema.invoices.status, "sent"),
      lt(schema.invoices.dueDate, now),
      inArray(schema.invoices.userId, payingUsers),
    ));

  let sent = 0;
  let skipped = 0;

  for (const invoice of due) {
    const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000);
    const step = nextStep(daysOverdue, invoice.remindersSent);
    if (step === null) { skipped++; continue; }

    const { subject, body } = toneFor(step);
    const link = `${env.APP_URL}/i/${invoice.publicToken}`;

    const ok = await sendEmail({
      to: invoice.clientEmail,
      replyTo: invoice.senderEmail,
      subject: `${subject} — invoice ${invoice.number}`,
      html: layout(`${body}
<table style="margin:18px 0;font-size:15px">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Invoice</td><td><strong>${invoice.number}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>${formatINR(invoice.totalPaise)}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Due</td><td>${invoice.dueDate.toDateString()} (${daysOverdue} days ago)</td></tr>
</table>
<p><a href="${link}" style="background:#0b5fff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">View and pay invoice</a></p>
<p style="color:#666;font-size:13px">Sent on behalf of ${invoice.senderName ?? invoice.senderEmail}. Reply to reach them directly.</p>`),
    });

    if (!ok) { skipped++; continue; }

    await db
      .update(schema.invoices)
      .set({ remindersSent: invoice.remindersSent + 1, lastReminderAt: now })
      .where(eq(schema.invoices.id, invoice.id));

    await track({
      product: "invoicing",
      name: "automation_ran",
      meta: { kind: "reminder", invoiceId: invoice.id, step, daysOverdue },
    });
    sent++;
  }

  return { sent, skipped };
}

if (process.argv[1]?.endsWith("dunning-engine.ts")) {
  runDunning()
    .then((r) => { console.log(`[dunning] sent=${r.sent} skipped=${r.skipped}`); process.exit(0); })
    .catch((err) => { console.error("[dunning] failed", err); process.exit(1); });
}
