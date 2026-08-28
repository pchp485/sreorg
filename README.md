# sreorg — a portfolio of small Indian-compliance SaaS products

Three products for Indian freelancers and small businesses, sharing one billing,
automation and growth engine, settling into one Indian bank account.

**Target: ₹30,000/month recurring.** Roughly 30 invoicing + 20 payroll + 20
compliance customers — about 70 people, not seventy thousand.

## Read this first

Software cannot create revenue. It can only run a business that has a product
people want and a channel that reaches them. Everything here automates the
*operating* of that business. What it cannot do is listed honestly in
[`RUNBOOK.md`](./RUNBOOK.md), and those parts decide whether this works.

Three products is also three times the surface area for one person. Read
[`docs/PORTFOLIO.md`](./docs/PORTFOLIO.md) before launching anything — especially
the sequencing rules and the kill criteria.

## The products

| Product | Price | Free tier | What the money buys |
|---|---|---|---|
| **invoicing** | ₹399/mo | GST calculators, 3 invoices/month | Chases every overdue invoice on day 3, 7, 14, 30 |
| **payroll** | ₹499/mo | In-hand salary calculator, 2 employees | Generates and emails every payslip on the 1st |
| **compliance** | ₹199/mo | Full deadline calendar | Emails you a week before each deadline that is yours |

Each free tier is genuinely usable. What you buy in every case is *automation* —
work that happens while the customer sleeps, which is why the subscription
renews instead of churning in month two.

## The loops

| Loop | What it does | Cadence |
|---|---|---|
| **Acquisition** | ~1,600 long-tail pages, plus a weekly job that drafts content for pages with traffic but no customers | Weekly |
| **Product** | Dunning daily, compliance reminders daily, payslips on the 1st | Daily / monthly |
| **Revenue** | Razorpay subscriptions → T+2 settlement to an Indian bank account | Continuous |
| **Judgement** | SCALE / FIX / HOLD / KILL verdict per product, against thresholds fixed in advance | Weekly |

## Layout

```
packages/core         billing, entitlements, auth, email, analytics, shared HTTP handlers
packages/tax-india    GST, TDS, payroll statutory maths, compliance calendar
packages/growth       programmatic-SEO helpers and the content drafting engine
packages/ui           shared checkout, chrome and styles
apps/invoicing        GST invoicing + dunning
apps/payroll          salary calculator + monthly payslips
apps/compliance       deadline calendar + reminders
scripts/portfolio-report.ts   MRR, per-product verdicts, and what to work on this month
```

Adding a fourth product is a row in `packages/core/src/products.ts`, a free tool,
and an automation script. Days, not months — that is the whole point of the
shared engine.

## Two design decisions worth knowing

**Razorpay is the only thing that can grant access.** One webhook, shared by all
three apps, signature-verified against the raw body and deduped on the event id.
Nothing else in the codebase may set a subscription active.

**Statutory rates are data, not code.** `packages/tax-india/src/rates/` is a
versioned, human-verified file with a review date. The engine that consumes it is
provably correct and unit-tested; the numbers are only as correct as the last
person who checked them against the Finance Act. Where a state's rules have not
been verified, the payslip *warns* rather than silently deducting zero.

## Running it

```bash
npm install
cp .env.example .env
npm run db:push

cd apps/invoicing && npm run dev     # or payroll, or compliance
```

```bash
npm run typecheck   # whole monorepo
npm test            # 80 tests
npm run build       # all three apps
npm run portfolio   # the Monday report, on demand
```

See [`RUNBOOK.md`](./RUNBOOK.md) to launch,
[`docs/PORTFOLIO.md`](./docs/PORTFOLIO.md) for sequencing and kill criteria, and
[`docs/UNIT-ECONOMICS.md`](./docs/UNIT-ECONOMICS.md) for the arithmetic.
