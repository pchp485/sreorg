import { env } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Resend's free tier (3k/month) covers magic links plus dunning for roughly the
 * first 200 customers. Returns false rather than throwing so a failed reminder
 * never takes down a cron run mid-batch.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY unset; would have sent "${message.subject}" to ${message.to}`);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    console.error(`[email] send failed (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

export function layout(body: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
${body}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0"/>
<p style="font-size:12px;color:#777">Sent by an automated invoicing assistant.</p>
</div>`;
}
