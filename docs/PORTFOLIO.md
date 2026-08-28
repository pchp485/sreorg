# The portfolio

Three products, one engine, one database, one bank account.

| Product | Price | Subs for ₹30k alone | The thing you pay for |
|---|---|---|---|
| **invoicing** | ₹399/mo | 76 | Chases every overdue invoice on day 3, 7, 14 and 30 |
| **payroll** | ₹499/mo | 61 | Generates and emails every payslip on the 1st |
| **compliance** | ₹199/mo | 151 | Emails you a week before each statutory deadline |

Or any mix: 30 invoicing + 20 payroll + 20 compliance also clears ₹30,000.

## Why these three and not three random ideas

Every one of them has the same shape, which is the only reason a portfolio is
cheaper than three separate businesses:

- **Same buyer.** An Indian freelancer or small-business owner. Someone who
  bought one is a warm lead for the next two, at zero acquisition cost.
- **Same funnel.** A free calculator that ranks in search, then a paid tier that
  automates the thing the calculator only measures.
- **Same reason to renew.** Each one does work while the customer sleeps. A
  product that only stores data gets cancelled the first quiet month; a product
  that emails your employees their payslips does not.
- **Same engine.** Billing, entitlements, email, analytics, growth and reporting
  are shared. A fourth product is a `products.ts` row, a free tool and an
  automation script — days, not months.

Three unrelated products would have shared none of that, and would have been
three businesses run badly instead of one run properly.

## The rule that makes this work

**A portfolio only beats a single product if dead products actually get shut down.**

Nobody kills their own project voluntarily, so the criteria are fixed in code
before there is anything to be attached to. `scripts/portfolio-report.ts` applies
them every Monday and emails the verdict:

| Verdict | Trigger | What you do |
|---|---|---|
| **HOLD** | Under 90 days old | Nothing. Search rankings have not landed yet. |
| **SCALE** | New subscribers in the last 30 days, churn under 10% | Put every content hour here. |
| **FIX** | Traffic but no customers, or churn over 10% | The offer is broken, not the traffic. Stop writing pages. |
| **KILL** | Over 180 days old, under ₹2,000 MRR, no new subscribers in a month | Shut it down this week. |

The report also names **one product to work on this month**. One person pushing
three products at once pushes none of them. That is the failure this file exists
to prevent.

## Sequencing — do not launch three things at once

Launching all three simultaneously means three unvalidated products, three
domains to age, and no idea which signal came from where.

1. **Weeks 1–2 — Razorpay KYC.** Nothing bills until this clears. Start it first.
2. **Weeks 2–4 — invoicing only.** One domain, one sitemap, one product to sell.
   Get to ten paying customers by hand before anything else ships.
3. **Month 3 — compliance.** Cheapest to run (no per-customer state beyond a
   profile row), lowest support burden, and it cross-sells to every invoicing
   customer you already have.
4. **Month 5 — payroll.** Highest price and the stickiest, but it needs employee
   data entered before it does anything, so it converts slowest from cold traffic.
   Sell it to people who already trust you.

If invoicing has not reached ten paying customers by month three, **do not launch
the second product.** A second zero is not diversification.

## What each product costs to run

Nothing until it has customers, and very little after.

| | invoicing | payroll | compliance |
|---|---|---|---|
| Hosting | Vercel free | Vercel free | Vercel free |
| Database | shared Neon free tier | shared | shared |
| Email volume per customer/month | ~4 | ~headcount | ~3 |
| Support burden | medium | high (money is involved) | very low |
| Content cost | high (~1,000 pages) | high (~550 pages) | low (24 pages) |

Resend's 3,000 free emails a month is the first ceiling anything hits, and it
sits at roughly double the ₹30,000 target. Payroll hits it first because it
emails every employee, not every customer — watch that one.

## The honest risk of doing this at all

Three products is three times the surface area for the same person. The failure
mode is not that one of them fails; it is that all three end up at 40% built and
none of them ranks for anything.

The kill criteria, the single-focus rule, and the sequencing above are the
mitigation. They only work if you actually obey the Monday email when it says
KILL about something you like.
