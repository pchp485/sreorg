# sreorg — an autonomous recurring-revenue system

A GST invoicing product for Indian freelancers, built so that the parts which
normally need a human — chasing payment, publishing content, collecting money —
run on their own.

**Target: ₹30,000/month recurring, settled into an Indian bank account.**
At ₹399/month that is **76 paying subscribers**. Not a hundred thousand. Seventy-six.

## Read this first

Software cannot create revenue. It can only run a business that has a product
people want and a channel that reaches them. Everything below automates the
*operating* of that business; the things it cannot automate are listed honestly
in [`RUNBOOK.md`](./RUNBOOK.md), and they are the parts that decide whether this
works.

Anything that promises autonomous, guaranteed returns with no product and no
customers is a scam. This is the opposite: a small, real business with the
boring parts removed.

## The three loops

| Loop | What it does | Cadence | Where |
|---|---|---|---|
| **Acquisition** | Drafts new long-tail pages for queries that already bring traffic but no customers, then opens a PR | Weekly | `.github/workflows/growth-engine.yml` |
| **Product** | Chases every overdue invoice for paying customers on day 3, 7, 14 and 30 | Daily | `.github/workflows/dunning.yml` |
| **Revenue** | Razorpay charges the card, the webhook grants access, money lands in your bank | Continuous | `src/app/api/webhooks/razorpay/route.ts` |

A fourth job emails you one weekly number: MRR against the ₹30,000 target, and
which pages produced paying customers.

## Why this product

The paid feature is *automatic follow-up on unpaid invoices*. It works because:

- **The pain is measurable.** Indian freelancers routinely wait 45+ days to be paid,
  mostly because nobody follows up. One invoice paid two weeks sooner pays for a year.
- **The chasing is unpleasant**, so humans skip it. A machine does not mind.
- **It runs while the customer sleeps**, which is exactly what makes a subscription renew
  instead of churning after month one.
- **The free tools rank.** ~1,000 long-tail pages ("gst invoice format for freelance
  designers in karnataka") generated from two small lists, at zero marginal cost.

## Stack, and what it costs

| Piece | Choice | Cost at 76 customers |
|---|---|---|
| Hosting | Vercel / Cloudflare free tier | ₹0 |
| Database | Neon free tier (Postgres) | ₹0 |
| Email | Resend free tier, 3k/month | ₹0 |
| Cron | GitHub Actions | ₹0 |
| Payments | Razorpay | 2% + GST on collections |
| Content drafting | Anthropic API | ~₹100–300/month |
| Domain | any registrar | ~₹900/year |

**Total upfront: the price of a domain.** Everything else stays free until you
have paying customers, and the only cost that scales is the payment fee.

## Getting it running

```bash
npm install
cp .env.example .env       # fill in the values named in RUNBOOK.md
npm run db:push            # create the schema
npm run dev
```

```bash
npm test          # 36 tests: GST arithmetic, webhook signatures, dunning schedule
npm run typecheck
npm run build
```

## Layout

```
src/lib/gst.ts             GST/TDS engine — slab-wise tax, GSTIN checksum, Sec 170 rounding
src/lib/razorpay.ts        Subscriptions + HMAC webhook verification
src/lib/entitlements.ts    Free vs Pro; Razorpay is the only source of truth
src/content/pseo.ts        Professions x states -> ~1,000 pages
src/app/api/webhooks/      The money path. Signature-verified and idempotent.
scripts/dunning-engine.ts  The product loop
scripts/growth-engine.ts   The acquisition loop (drafts, never publishes)
scripts/kpi-report.ts      The instrument panel
```

See [`RUNBOOK.md`](./RUNBOOK.md) for launch steps and
[`docs/UNIT-ECONOMICS.md`](./docs/UNIT-ECONOMICS.md) for the arithmetic behind ₹30,000.
