# Runbook

Everything the machine cannot do for you, in the order it needs doing.

---

## Part 0 — What is honestly automated, and what is not

**Runs without you, forever:**

- Billing and renewal (Razorpay charges the card every month)
- Granting and revoking access when payment succeeds or fails
- Chasing every overdue invoice on behalf of every paying customer
- Publishing ~1,000 long-tail pages and keeping the sitemap current
- Drafting new content each week, aimed at the pages closest to converting
- Telling you, weekly, exactly how far you are from ₹30,000

**Cannot be automated, and pretending otherwise is how people lose a year:**

- **KYC.** Razorpay needs your PAN, bank account and address. A human at Razorpay
  approves it. Budget 2–5 working days.
- **The first ten customers.** No content engine produces revenue in week one.
  SEO takes 3–6 months to compound. Your first ten come from you posting in the
  places Indian freelancers already are, and talking to people.
- **Deciding the content is correct.** The growth engine opens a PR; it does not
  merge one. This is tax content — a wrong TDS rate costs a reader money and costs
  you the ranking. Two minutes a week of actually reading it.
- **Support email.** Roughly one message per ten customers per month.

Expect **20–30 minutes a week** once it is running. Not zero. Small.

---

## Part 1 — Accounts (one evening)

1. **Domain** — any registrar, ~₹900/year. The only money you spend before revenue.
2. **GitHub** — this repo. All four cron jobs run here, free.
3. **Neon** (neon.tech) — free Postgres. Copy the connection string.
4. **Vercel** (or Cloudflare Pages) — connect the repo. Free tier.
5. **Resend** (resend.com) — free tier, 3,000 emails/month. Verify your domain for
   sending, or reminders land in spam and the product silently does nothing.
6. **Razorpay** (razorpay.com) — sign up, complete KYC. **Start this first**, it is
   the long pole. Then enable **Subscriptions** in the dashboard.
7. **Anthropic API** — for the growth engine. Pay-as-you-go, ~₹100–300/month at this
   volume.

---

## Part 2 — Razorpay (the money path)

1. Finish KYC. Settlements go to your Indian bank account on a T+2 cycle by default.
2. Create two plans in **Subscriptions → Plans**:
   - `Pro Monthly` — ₹399, billing cycle monthly
   - `Pro Yearly` — ₹3,990, billing cycle yearly
   Copy both plan IDs into `RAZORPAY_PLAN_ID_PRO_MONTHLY` / `_YEARLY`.
3. Create a webhook under **Settings → Webhooks**:
   - URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Secret: generate one, put it in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `subscription.activated`, `subscription.charged`, `subscription.halted`,
     `subscription.cancelled`, `subscription.completed`, `subscription.pending`,
     `subscription.paused`, `subscription.resumed`
4. Test in **test mode** first. Subscribe with a test card, confirm the webhook
   fires and the row in `subscriptions` flips to `active`. Only then go live.

> The webhook handler is the only thing in this system allowed to grant Pro.
> It verifies the HMAC against the raw request body and dedupes on
> `x-razorpay-event-id`, because Razorpay retries for 24 hours. Do not add a
> second path that grants access — that is how people give away the product.

---

## Part 3 — Deploy

Set these in Vercel (Environment Variables) **and** in GitHub
(Settings → Secrets and variables → Actions), since the cron jobs run there:

| Name | Where | Notes |
|---|---|---|
| `DATABASE_URL` | secret | Neon connection string |
| `AUTH_SECRET` | secret | `openssl rand -hex 32` |
| `APP_URL` | variable | `https://yourdomain.com` |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` | secret | |
| `RAZORPAY_WEBHOOK_SECRET` | secret | |
| `RAZORPAY_PLAN_ID_PRO_MONTHLY` / `_YEARLY` | secret | |
| `RESEND_API_KEY` | secret | |
| `EMAIL_FROM` | variable | `Invoices <billing@yourdomain.com>` |
| `OPERATOR_EMAIL` | secret | where the weekly KPI mail goes |
| `ANTHROPIC_API_KEY` | secret | growth engine only |

Then:

```bash
npm run db:push
```

Submit `https://yourdomain.com/sitemap.xml` to Google Search Console. This is the
single highest-leverage five minutes in the whole runbook — it is how ~1,000 pages
get discovered without a single backlink.

---

## Part 4 — The first ten customers (this is the real work)

SEO compounds but starts slow. Months 1–3 are manual. Do this:

- **Answer the question, then mention the tool.** r/IndiaTax, r/freelanceIndia,
  r/developersIndia and the equivalent Facebook and WhatsApp groups have people
  asking "how do I invoice a US client from India" every week. Answer properly.
  Link the calculator, not the pricing page.
- **Twitter/X and LinkedIn**, where Indian freelancers already talk about not
  being paid. Post the free tools. Nobody resents a free GST calculator.
- **Go where the invoices are.** Design and dev agencies with 5–20 freelancers on
  their books have this problem at scale.
- **Ask every single free user why they have not paid.** One line, sent manually.
  This is worth more than any analytics dashboard for the first hundred users.

Ten paying customers proves the thing is real. The engine's job is getting from
ten to seventy-six.

---

## Part 5 — The weekly loop

Every Monday you get one email: MRR against ₹30,000, and which pages produced
paying customers.

1. **Merge or reject the growth PR.** Read every number in it. Wrong SAC code or
   TDS rate → reject, do not "fix later".
2. **Look at the pages with traffic and zero conversions.** High views and no
   signups means the page ranks but the offer does not land. Fix the call to
   action *before* writing anything new.
3. **Write more like the winners.** The engine already prioritises this; you are
   sanity-checking it.

---

## Part 6 — What to do when it stalls

| Symptom | Most likely cause | Fix |
|---|---|---|
| Traffic, no signups | Free tier too generous, or CTA too weak | Tighten the invoice limit; make the reminder feature visible in the free flow |
| Signups, no payment | The pain is not felt yet | Only users who have *sent* an invoice feel it. Trigger the upgrade prompt there, not on signup |
| Payment, then churn in month 2 | They stopped sending invoices | Add a monthly "you have 2 invoices overdue" email — that is the retention hook |
| No traffic after 4 months | Pages are too thin to rank | Fewer, deeper pages. Kill the combos with no search volume |
| Reminders not sending | Domain not verified in Resend | Verify SPF/DKIM. Check the dunning workflow run log |

---

## Legal and tax, briefly

- Register as a **sole proprietorship** to start. A current account in the business
  name is enough; you do not need a private limited company at ₹30k/month.
- **GST registration** is required once turnover crosses ₹20 lakh/year
  (₹10 lakh in special-category states). At ₹30k/month you are well under, but
  register voluntarily if your customers want to claim input credit.
- You are collecting money from customers for a service. **Publish terms, a privacy
  policy and a refund policy** — Razorpay requires them anyway.
- Talk to a CA before you cross ₹20 lakh. It is a few thousand rupees and it
  prevents expensive mistakes.
