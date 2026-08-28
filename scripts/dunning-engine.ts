/**
 * The product loop. Runs every day; finds invoices past their due date belonging
 * to paying customers, and sends the follow-up the freelancer would not have sent.
 *
 * This is what the ₹399 buys, and it is the reason the subscription renews.
 */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { sendEmail, layout } from "../src/lib/email";
import { formatINR } from "../src/lib/money";
import { track } from "../src/lib/analytics";
import { env } from "../src/lib/env";
import { PAYING_STATUSES } from "../src/lib/entitlements";

/** Days past due at which a reminder goes out. Escalating, never rude. */
const SCHEDULE = [3, 7, 14, 30] as const;

function toneFor(daysOverdue: number, step: number): { subject: string; body: string } {
  if (step === 0) {
    return {
      subject: "Just checking this landed",
      body: `<p>Hi — a quick nudge that this invoice came due a few days ago. If it is already
      in your payment run, please ignore this.</p>`,
    };
  }
  if (step === 1) {
    return {
      subject: "Following up on an unpaid invoice",
      body: `<p>Hi — following up on this one, now a week past due. If something is blocking
      approval on your side, tell me what you need and I will send it across.</p>`,
    };
  }
  if (step === 2) {
    return {
      subject: "Invoice now two weeks overdue",
      body: `<p>Hi — this invoice is two weeks past its due date. Could you confirm a payment
      date so I can plan around it?</p>`,
    };
  }
  return {
    subject: "Invoice 30 days overdue — please advise",
    body: `<p>Hi — this invoice is now thirty days past due. Please let me know when it will
    be settled, or who I should be speaking to instead.</p>`,
  };
}

export function nextStep(daysOverdue: number, remindersSent: number): number | null {
  // Send at most one reminder per run, and only when the next milestone is reached.
  const step = remindersSent;
  if (step >= SCHEDULE.length) return null;
  return daysOverdue >= SCHEDULE[step] ? step : null;
}

export async function runDunning(now = new Date()): Promise<{ sent: number; skipped: number }> {
  // Only paying customers get automation — that is the entitlement boundary.
  const payingUsers = db
    .select({ userId: schema.subscriptions.userId })
    .from(schema.subscriptions)
    .where(inArray(schema.subscriptions.status, [...PAYING_STATUSES]));

  const due = await db
    .select({
      id: schema.invoices.id,
      number: schema.invoices.number,
      dueDate: schema.invoices.dueDate,
      totalPaise: schema.invoices.totalPaise,
      remindersSent: schema.invoices.remindersSent,
      publicToken: schema.invoices.publicToken,
      clientName: schema.clients.name,
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

    const { subject, body } = toneFor(daysOverdue, step);
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

    await track({ name: "reminder_sent", meta: { invoiceId: invoice.id, step, daysOverdue } });
    sent++;
  }

  return { sent, skipped };
}

if (process.argv[1]?.endsWith("dunning-engine.ts")) {
  runDunning()
    .then((r) => { console.log(`[dunning] sent=${r.sent} skipped=${r.skipped}`); process.exit(0); })
    .catch((err) => { console.error("[dunning] failed", err); process.exit(1); });
}
