# Architecture

## The money path

```
Visitor → /invoice/<profession>/<state>   (static, ranks in search)
        → free calculator, no signup      (proves the thing works)
        → /pricing → POST /api/billing/subscribe
        → Razorpay hosted checkout        (no card data ever touches us)
        → Razorpay charges the card
        → POST /api/webhooks/razorpay     ← the ONLY writer of entitlement
        → subscriptions.status = 'active'
        → T+2 settlement to your Indian bank account
```

Three invariants hold this together:

1. **Razorpay is the source of truth for whether money arrived.** Nothing else in
   the codebase may set a subscription to `active`. One granting path, one place
   to audit.
2. **The webhook is idempotent.** Razorpay retries for 24 hours. Every event is
   inserted into `webhook_events` keyed on `x-razorpay-event-id` first; a
   duplicate short-circuits before any side effect.
3. **The signature is checked against the raw body.** Parsing and re-serialising
   JSON changes key order and whitespace, and the HMAC will never match. The
   handler reads `request.text()` before anything else, deliberately.

## Why entitlement is cached locally

`getPlan()` reads the local `subscriptions` table, never Razorpay's API. Page
renders must not depend on a third-party API being up, and a rate limit on
Razorpay must never become a "your subscription has expired" message to a paying
customer. The webhook keeps the cache correct.

## Why the growth engine opens a PR instead of publishing

This is tax-adjacent content. A hallucinated SAC code or TDS threshold costs a
reader real money, and Google punishes incorrect YMYL content hard. The engine is
given the verified numbers in its prompt and told explicitly not to invent any
others — but the actual safety mechanism is a human reading a small weekly diff.

The CI step in that workflow runs typecheck and tests *before* the PR is opened,
so a broken batch never reaches review.

## Why paise, never floats

Every amount in the system is an integer count of paise. `0.1 + 0.2` problems
become rupee-level invoice disputes, and GST returns must reconcile exactly.
`src/lib/money.ts` is the only place rupees exist, and only for display.

Tax is computed **per rate slab**, not per line item: summing rounded per-line
tax drifts from what the GST portal computes on the slab total, and that drift is
what makes a return fail reconciliation.

## Why the free tier is generous

Three invoices a month covers a hobbyist forever, deliberately. The paid trigger
is *automation*, not volume — the moment a customer has an invoice that is three
days overdue and does not want to write the email. Gating volume annoys people
who would never have paid; gating the thing that recovers ₹50,000 does not.

## Cost ceilings on the free tiers

| Service | Free tier | Roughly holds until |
|---|---|---|
| Neon | 0.5 GB storage | ~50,000 invoices |
| Resend | 3,000 emails/month | ~200 paying customers |
| Vercel | 100 GB bandwidth | ~200,000 page views/month |
| GitHub Actions | 2,000 minutes/month | far beyond any of the above |

Every one of these ceilings sits above ₹30,000 MRR. The first thing that will
cost money is Resend, at roughly double the target.
