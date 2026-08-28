# The strategy, and why this one

## The honest frame

You asked for ₹30,000/month, constant, autonomous, minimal investment.

Three of those four are achievable. **Autonomous is the one that isn't** — not
at the start, and not in the way the phrase is usually sold. Here is the split,
precisely:

| Part of the business | Can it run without you? |
| --- | --- |
| Traffic from published content | Yes, permanently, once written |
| Lead capture and storage | Yes |
| Checkout and payment collection | Yes |
| Delivery of a digital product | Yes — instantly, at 3am |
| Reconciliation and reporting | Yes |
| Renewals | Yes |
| **Deciding what to sell** | No |
| **The first ~20 customers** | No |
| **Trust** | No, and this is the whole game |

Everything in the "yes" column is built and tested in this repo. The "no"
column is roughly 6–10 hours a week for the first three months. Anyone selling
you a system without that column is selling you the dream, not the business.

## Why this product and not something else

The instinct is to look for a clever niche. You already have a better asset
than any niche you could find:

**You shipped a real product.** `ieee_vtools_automation` is 5,800 lines that
run a live IEEE Section's events across four platforms with an approval gate.
That is not a demo. Most people trying to sell "automation" have never shipped
anything that touches a live account.

**You have unfakeable standing.** You are Chair of IEEE Houston Section. When
you write to another Section Chair, you are a peer with the same problem, not a
vendor. That is the single most valuable distribution asset in this plan, and
it cannot be bought.

**The audience is real, reachable and underserved.** IEEE has ~340 sections and
several thousand chapters worldwide. Every one is run by volunteers doing
vTools, eNotice, website and LinkedIn by hand, in evenings, after a day job.
Nobody sells them tools, because the market looks too small to a funded
company — which is exactly what makes it a good one-person business.

So the product is what you already built, packaged. Not a new idea.

## The ladder

Run `revenue offers` for live numbers.

1. **Free** — the open toolkit and the writing. Costs nothing, builds the trust
   everything else depends on.
2. **₹1,499 — Section & Chapter Automation Kit.** Digital, instant, infinite
   supply. This is the rung that earns while you sleep.
3. **₹3,999 — Agentic Ops Playbook.** The transferable version for engineers
   generally, not just IEEE. Broader audience, higher price.
4. **₹9,999 — Automation Teardown.** 90 minutes plus a written plan. Capped at
   four a month because it costs three real hours each.
5. **₹6,999/month — Managed Section Ops.** The toolkit run as a service. This
   is the only rung that makes revenue *constant*.

## The mix that actually reaches the target

`revenue plan` computes this, and prefers subscriptions because the goal says
constant:

> **4 managed subscriptions + 2 kit sales = ₹30,262/month net, at 8 delivery
> hours a month.**

Four customers. Not four hundred. That is the number worth holding on to when
month two produces nothing.

The alternative all-digital path — 21 kit sales a month, zero delivery hours —
is more autonomous but needs roughly 5,000 visits a month to sustain. Both are
in the plan output; the blended one is faster to reach and less fragile.

## The constraint nobody mentions

That mix implies **~9,000 visits a month**. That is the whole difficulty of
this business, and it is why the content engine is the most important module
here rather than the payment code.

Nine thousand visits is not exotic — it is eight to ten genuinely useful
articles that rank, plus talks, plus showing up where the audience already is
(IEEE officer forums, R5 mailing lists you are legitimately part of, LinkedIn
posts written by hand). It takes months, not weeks. The topic bank in
`config/topics.json` is the first eight, each tied to something you actually
built.

## Sequencing: what to do in what order

**Weeks 1–2 — settle the constraints, then take one payment.**
Read `docs/COMPLIANCE.md` first; the employer disclosure gates everything.
Open the Razorpay account. Package the kit. Then `revenue sell ... --live` and
send the link to one person. One real rupee proves the rail end to end and is
worth more than a month of planning.

**Weeks 3–8 — publish, and talk to officers.**
One article a week from the topic bank. In parallel, twenty personal emails to
Section and Chapter officers — one at a time, `revenue lead draft`, edited by
you. Offer a free sample draft for their next event. Expect two or three
replies; that is a normal rate, not a failure.

**Weeks 9–16 — convert the conversations into the four subscriptions.**
The officers who accepted a free sample are the pipeline. Managed Section Ops
is an easy yes for someone who has already seen it produce their event.

**Month 5+ — the engine carries the digital rungs and you defend the base.**
Renewals matter more than new sales now. `revenue status` reports MRR
separately for exactly this reason.

## How you will know it is failing

- **Month 3, fewer than 50 consented leads.** The content is not landing.
  Change the topics, not the price.
- **Month 4, replies but no purchases.** The offer is wrong, not the traffic.
  Talk to five people who said no and ask what they expected.
- **Month 6, no subscriptions.** The service rung is mispriced or the promise
  is unclear. Consider selling the teardown first as a way in.

Fail these honestly and stop, rather than spending a year on it. A business
that cannot find four customers in six months is telling you something.
