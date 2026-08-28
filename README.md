# revenue-engine

The automatable half of a one-person business, built to carry a specific
product: the IEEE section-automation toolkit in `ieee_vtools_automation`,
packaged and sold.

Target: **₹30,000/month net, recurring, into an Indian bank account.**

```bash
export PYTHONPATH=src

python -m revenue check      # what is configured; contacts nothing
python -m revenue offers     # the ladder and its real unit economics
python -m revenue plan       # shortest honest path to the target
python -m revenue status     # where revenue actually is this month
```

Those four work right now, with an empty `.env`.

## What is honest about this

**It does not generate income by itself.** No system does. What it does is run
every repeatable part so the only thing needing your attention is the part that
genuinely cannot be automated — earning the first customers' trust.

| Automated, permanently | Needs you |
| --- | --- |
| Content drafted and queued weekly | Finishing and publishing it |
| Lead capture, consent tracking, staging | The personal outreach |
| Checkout links, payment collection | Deciding what to sell |
| **Delivery of a purchase, instantly, at 3am** | The first ~20 customers |
| Renewals, reconciliation, reporting | Replying to humans |

Budget 6–10 hrs/week for three months on the right-hand column. `revenue plan`
shows a ramp that earns **₹0 in month one**, because that is the true shape of
it.

## The number

```
4 managed subscriptions + 2 kit sales = ₹30,262/month net, at 8 delivery hrs/month
```

Four recurring customers. The same command also shows what that implies:
~9,000 visits/month. That traffic is the actual difficulty — the payment code
here is the easy part, and it is already done.

## Layout

```
config/offers.json      the ladder: price, capacity, delivery hours
config/topics.json      the content bank; every topic carries real proof
config/targets.json     the target and the funnel assumptions

src/revenue/
  plan.py               gap analysis: what mix reaches the target, and the traffic it needs
  catalog.py            offers, loaded from config
  payments/razorpay.py  payment links, HMAC verification, settlements
  payments/webhook.py   stdlib receiver: payment in, product out
  fulfil.py             delivery, idempotent, plus a sweep for what the webhook missed
  leads.py              capture and nurture, consent enforced in code
  content.py            the top-of-funnel engine
  metrics.py            MRR vs one-off, net of fees, gap to target
  cli.py                one entry point

.github/workflows/      the 24/7 runtime, on GitHub's free tier
docs/                   strategy, money rails, compliance, runbook
```

**No third-party dependencies.** Stdlib only, so it runs on a bare CI runner
with no install step and nothing to break when a package updates.

## Safety rules, enforced in code not prose

- Every command that spends money or sends mail is **dry by default**; `--live`
  is required.
- Webhooks are **HMAC-verified with a constant-time compare**; the signature
  doubles as the idempotency key. Failure returns 500 so the gateway retries.
- Delivery **refuses any order not in `paid` status**, and never sends twice.
- `leads.capture` **refuses to record consent without evidence** of where it
  came from.
- There is **no bulk send function**. Outreach is drafted one message at a time
  for a human to send. This is deliberate and should stay that way.

## Read before going live

1. [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) — **first.** Employer outside-business-activity
   disclosure, and the IEEE conflict-of-interest position. Both gate launch.
2. [`docs/MONEY_RAILS.md`](docs/MONEY_RAILS.md) — Razorpay, settlement timing, and what
   changes the moment a buyer is outside India (LUT, FIRC, purpose codes).
3. [`docs/STRATEGY.md`](docs/STRATEGY.md) — the offer ladder, the sequencing, and how to
   tell it is failing.
4. [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — daily and weekly operation.

## Tests

```bash
PYTHONPATH=src python3 -m unittest discover -s tests
```

29 tests, covering signature forgery, amount tampering, double delivery,
consent enforcement, and whether the planner's recommended mix actually clears
the target.
