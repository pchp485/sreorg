# Unit economics

## The target, in customers

₹30,000/month, at each product's own price:

| Product | Price | Alone | Realistic mix |
|---|---|---|---|
| invoicing | ₹399/mo | 76 | 30 |
| payroll | ₹499/mo | 61 | 20 |
| compliance | ₹199/mo | 151 | 20 |

The mix column also clears ₹30,000 — and is far more likely than 76 of anything,
because each product is fishing a different query pool.

## What ₹30,000 MRR actually deposits

| Line | Amount |
|---|---|
| Gross collections | ₹30,000 |
| Razorpay fee (2% + 18% GST on the fee) | −₹708 |
| Neon, Vercel, Resend, GitHub Actions | ₹0 (free tiers hold past this) |
| Anthropic API (growth engine, 2 products) | −₹300 |
| Domains, 3 × ₹900/year amortised | −₹225 |
| **Net into your account** | **≈ ₹28,750** |

~96% margin, because there is no cost of goods. That is the entire reason to
build software rather than sell hours.

## Traffic needed

Honest free-tool-to-paid conversion rates:

| Step | Rate |
|---|---|
| Page view → tool used | 40% |
| Tool used → signup | 5% |
| Signup → paid | 8% |

That is **0.16% of visitors becoming customers**. For the 70-customer mix above,
allowing for ~5% monthly churn, you need roughly **20,000–25,000 monthly visits
across all three sites**.

Spread over ~1,600 generated pages, that is about **13 visits per page per
month** — a low bar for a long-tail page with almost no competition, and the
entire argument for programmatic SEO over trying to rank one page for "gst
invoice".

## Timeline, without optimism

| Month | What is happening | Plausible MRR |
|---|---|---|
| 1 | KYC, invoicing deployed, sitemap submitted. Manual outreach only. | ₹0–1,200 |
| 2–3 | Google indexes the long tail. First rankings on the least competitive combos. | ₹1,200–4,000 |
| 4–6 | Compliance launches and cross-sells. Pages compound. | ₹5,000–14,000 |
| 7–9 | Payroll launches to warm customers. The winners are known. | ₹12,000–25,000 |
| 10–15 | Multiply what works, kill what does not. | ₹20,000–35,000 |

**Realistic: 10–15 months to ₹30,000, with weekly attention.** The portfolio does
not make it faster — it makes the outcome less dependent on any one product
working, which is a different and more defensible claim.

## Where the model breaks

- **Reminder and payslip emails land in spam.** Then all three products silently
  do nothing and everyone churns in month two. Verify every sending domain
  properly. This is the single biggest technical risk in the system.
- **Payroll gets a number wrong.** Salary is the one place a bug is unforgivable.
  The rates live in a versioned, human-verified file precisely because the engine
  cannot check the law for itself — and it warns rather than guessing for any
  state it has not been told about.
- **Google decides the pages are thin.** Mitigated by every page carrying a
  working calculator and real profession- or state-specific facts, but it is a
  genuine risk. Fewer, deeper pages beat more, thinner ones.
- **Razorpay KYC is rejected.** Then no product has a revenue path at all. Start
  it before writing another line of code.
- **Three products, one person, none finished.** The likeliest failure by some
  distance. See the sequencing rules in `PORTFOLIO.md` and obey them.

## The lever nobody uses

Raising invoicing from ₹399 to ₹799 halves the customers needed, 76 → 38. For a
product that recovers a ₹50,000 invoice six weeks early, ₹799 is still trivial.

**Test the higher price before building a fourth product.** Pricing is free to
change and costs one deploy; a new product costs a quarter.
