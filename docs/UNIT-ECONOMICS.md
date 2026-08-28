# Unit economics

## The target, in customers

| Plan | Price | Customers for ₹30,000/month |
|---|---|---|
| Pro monthly | ₹399 | **76** |
| Pro yearly | ₹3,990 (₹332.50/mo effective) | 91 |

Seventy-six people. That is the entire goal. It is a WhatsApp group, not a market.

## What ₹30,000 MRR actually deposits

| Line | Amount |
|---|---|
| Gross collections | ₹30,000 |
| Razorpay fee (2% + 18% GST on the fee) | −₹708 |
| Neon, Vercel, Resend, GitHub Actions | ₹0 (free tiers hold to ~500 customers) |
| Anthropic API (growth engine) | −₹200 |
| Domain (amortised) | −₹75 |
| **Net into your account** | **≈ ₹29,000** |

Margin is ~97% because there is no cost of goods. This is the entire reason to
build software rather than sell time.

## Traffic needed

Honest conversion rates for a free-tool-to-paid-SaaS funnel:

| Step | Rate | Needed monthly |
|---|---|---|
| Page view → tool used | 40% | 25,000 views |
| Tool used → signup | 5% | 10,000 uses |
| Signup → paid | 8% | 500 signups |
| | | **40 new paying customers/month** |

At ~5% monthly churn, 76 subscribers needs about 4 net additions a month once
you are there. Getting to 76 in the first place is roughly two months at the
rate above — but only *after* the pages rank, which is the 3–6 month wait.

**25,000 monthly views across ~1,000 pages is 25 views per page per month.**
That is an extremely low bar for a long-tail page with almost no competition,
and it is the whole argument for programmatic SEO over trying to rank one page
for "gst invoice".

## Timeline, without optimism

| Month | What is actually happening | Plausible MRR |
|---|---|---|
| 1 | KYC, deploy, sitemap submitted. Manual outreach only. | ₹0–1,200 |
| 2–3 | Google indexes the long tail. First rankings appear on the least competitive combos. | ₹1,200–4,000 |
| 4–6 | Pages compound. Growth engine has 20+ weeks of content in. | ₹6,000–15,000 |
| 7–12 | The winners are known and being multiplied. | ₹20,000–35,000 |

**Realistic: 8–14 months to ₹30,000, with weekly attention.** Anyone promising
faster is selling something.

## Where the model breaks

- **Reminder emails land in spam.** Then the product silently does nothing and
  everyone churns in month two. Verify the sending domain properly; this is the
  single biggest technical risk in the system.
- **Google decides the pages are thin.** Mitigated by every page carrying a
  working tool and profession-specific facts, but it is a real risk. Fewer,
  deeper pages beat more, thinner ones.
- **Razorpay KYC is rejected.** Then there is no revenue path at all. Start it
  first, before writing another line of code.
- **Nobody actually wants automated chasing.** The one assumption no code can
  test. Ask ten freelancers before month three, not after month nine.

## The lever nobody uses

Raising the price from ₹399 to ₹799 halves the customers needed, from 76 to 38.
For a product that recovers a ₹50,000 invoice six weeks early, ₹799 is still
trivially cheap. **Test the higher price before you build more features.**
