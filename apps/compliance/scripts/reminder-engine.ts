/**
 * The compliance product loop. Runs daily; emails each paying customer about the
 * obligations coming due inside their lead window.
 *
 * The reminder_log unique index is the whole safety mechanism: a customer must
 * never be reminded twice about the same deadline, or they stop reading the
 * emails and the product becomes worthless.
 */
import { eq, inArray } from "drizzle-orm";
import { db, schema, sendEmail, layout, track, payingUserIds } from "@sreorg/core";
import { obligationsDueBetween, type ComplianceProfile, type EntityType } from "@sreorg/tax-india";

const DAY = 86_400_000;

export async function runReminders(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const payingUsers = await payingUserIds("compliance");
  if (payingUsers.length === 0) return { sent: 0, skipped: 0 };

  const profiles = await db
    .select({
      userId: schema.complianceProfiles.userId,
      entityType: schema.complianceProfiles.entityType,
      gstRegistered: schema.complianceProfiles.gstRegistered,
      gstScheme: schema.complianceProfiles.gstScheme,
      deductsTds: schema.complianceProfiles.deductsTds,
      hasEmployees: schema.complianceProfiles.hasEmployees,
      stateCode: schema.complianceProfiles.stateCode,
      leadDays: schema.complianceProfiles.leadDays,
      email: schema.users.email,
    })
    .from(schema.complianceProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.complianceProfiles.userId))
    .where(inArray(schema.complianceProfiles.userId, payingUsers));

  let sent = 0;
  let skipped = 0;

  for (const row of profiles) {
    const profile: ComplianceProfile = {
      entityType: row.entityType as EntityType,
      gstRegistered: row.gstRegistered,
      gstScheme: row.gstScheme as "monthly" | "qrmp",
      deductsTds: row.deductsTds,
      hasEmployees: row.hasEmployees,
      stateCode: row.stateCode,
    };

    // Only obligations landing exactly on the lead-day boundary, so each one is
    // considered once rather than every day of the window.
    const target = new Date(now.getTime() + row.leadDays * DAY);
    const dayStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + DAY - 1);

    const due = obligationsDueBetween(profile, dayStart, dayEnd);
    if (due.length === 0) { skipped++; continue; }

    const fresh: typeof due = [];
    for (const o of due) {
      const dueDate = o.dueDate.toISOString().slice(0, 10);
      const claimed = await db
        .insert(schema.reminderLog)
        .values({ userId: row.userId, obligation: o.code, dueDate })
        .onConflictDoNothing()
        .returning({ id: schema.reminderLog.id });
      if (claimed.length > 0) fresh.push(o);
    }

    if (fresh.length === 0) { skipped++; continue; }

    await sendEmail({
      to: row.email,
      subject: fresh.length === 1
        ? `Due in ${row.leadDays} days: ${fresh[0].label}`
        : `${fresh.length} deadlines in ${row.leadDays} days`,
      html: layout(`<h2>Coming up in ${row.leadDays} days</h2>
${fresh.map((o) => `<div style="margin-bottom:16px">
  <strong>${o.label}</strong><br/>
  <span style="color:#666">Due ${o.dueDate.toDateString()}</span><br/>
  <span style="color:#666;font-size:13px">${o.penalty}</span>
</div>`).join("")}
<p style="color:#666;font-size:13px">Dates are the statutory ones. If the government has
notified an extension, you have longer than this — never less.</p>`),
    });

    await track({
      product: "compliance",
      name: "automation_ran",
      userId: row.userId,
      meta: { kind: "reminder", obligations: fresh.map((o) => o.code) },
    });
    sent++;
  }

  return { sent, skipped };
}

if (process.argv[1]?.endsWith("reminder-engine.ts")) {
  runReminders()
    .then((r) => { console.log(`[compliance] sent=${r.sent} skipped=${r.skipped}`); process.exit(0); })
    .catch((err) => { console.error("[compliance] failed", err); process.exit(1); });
}
