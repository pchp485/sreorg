# Money rails: getting rupees into an Indian account, legally

This is the part people skip, and it is the part that actually decides whether
money arrives.

## Collecting from Indian buyers

**Razorpay** (or Cashfree / PhonePe PG — same shape). Chosen because:

- Settles INR directly to an Indian current or savings account.
- Onboards an **individual / sole proprietor** — no company needed. PAN,
  Aadhaar, a bank proof, and a working website or product page.
- No setup fee and no monthly minimum. You pay only when you get paid.
- Supports UPI, which is how most Indian buyers actually pay.

Cost: ~2% + 18% GST **on the fee** = **2.36% effective**. The engine already
subtracts this everywhere; `revenue offers` shows net, not gross.

Settlement is **T+2** by default. A captured payment is not money in the bank —
`revenue reconcile` reads the settlements API precisely because the payments
list flatters you.

## Collecting from buyers outside India

Most IEEE section officers are **not** in India. This changes the problem.

Taking foreign money is an **export of services**, and it comes with
obligations:

- **FEMA / purpose code.** Inward remittance must be reported with a purpose
  code (typically P0802 — software consultancy / services). Your bank or the
  gateway handles the filing, but you must supply it.
- **FIRC / eBRC.** Get a Foreign Inward Remittance Certificate for each
  payment. Without it you cannot later prove the money was export income, and
  that becomes an income-tax problem, not a banking one.
- **GST.** Export of services is **zero-rated**, but only if you either
  (a) file a **LUT** (Letter of Undertaking, free, annual, on the GST portal)
  and export without paying IGST, or (b) pay IGST and claim a refund. Option
  (a) is obviously better. Note that **GST registration is compulsory for
  export of services regardless of turnover** in the common reading — confirm
  with a CA for your specific facts before invoicing a foreign customer.
- Options: Razorpay International (needs approval, ~3% + GST), or
  **Payoneer / Wise Business** which give you a receiving account and hand you
  clean FIRC-equivalent documentation.

**Practical sequencing:** launch domestic-only. Add international once there is
a first foreign buyer worth the paperwork — not before. The engine's
`--international` flag exists so the economics are already modelled when
that day comes.

## Tax, plainly

- Income from this is **business income**, not capital gains, not "other".
- **Section 44ADA presumptive taxation** may apply if this is professional
  income under ₹75 lakh — 50% deemed profit, minimal bookkeeping. Very likely
  the right choice at this scale. Confirm eligibility with a CA.
- **Advance tax** is due quarterly once liability exceeds ₹10,000/year.
- Keep every invoice. `revenue status` is a management report, not a book of
  accounts.

## What this system deliberately does not do

- It does not move money between accounts.
- It does not store card details — Razorpay's hosted page means you never
  touch PCI scope.
- It does not issue GST-compliant tax invoices. Once you are registered, that
  numbering has statutory requirements; use the gateway's invoicing or an
  accounting tool rather than inventing one here.

None of this is legal or tax advice. The ₹3,000–5,000 a CA charges to set the
structure up correctly is the highest-return spend in this entire plan.
