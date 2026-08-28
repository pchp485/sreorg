# Runbook

## First run (nothing configured)

```bash
cd sreorg
export PYTHONPATH=src

python -m revenue check        # what is missing; contacts nothing
python -m revenue offers       # the ladder and its unit economics
python -m revenue plan         # shortest path to the target
python -m revenue content plan # the next eight weeks of writing
```

All of these work with an empty `.env`. Nothing above touches a live system.

## Going live

1. **Read `docs/COMPLIANCE.md`.** The employer disclosure gates everything.
2. Razorpay account (individual/proprietor: PAN, bank proof, product page).
3. `cp .env.example .env` and fill it in. Never commit it.
4. Add the same values to GitHub → Settings → Secrets → Actions.
5. `python -m revenue check` until it reports ready.

## Taking a payment

```bash
python -m revenue sell section-ops-kit --email buyer@example.com          # dry
python -m revenue sell section-ops-kit --email buyer@example.com --live   # real link
```

Send the returned `pay_at` URL. Delivery happens by itself when the webhook
fires.

## The webhook

Razorpay must reach a public URL. Cheapest options, in order:

```bash
# local, for testing
python -m revenue serve --port 8080
cloudflared tunnel --url http://localhost:8080     # gives a public https URL
```

For production use any always-on free tier (Fly.io, Render, Oracle free VM).
Register the URL in Razorpay Dashboard → Settings → Webhooks, subscribe to
`payment_link.paid`, `payment.captured`, `subscription.charged`, and set the
secret to `RAZORPAY_WEBHOOK_SECRET`.

Verify it works: Razorpay's dashboard has a "Send test webhook" button. A
correct setup returns `{"ok": true}` and delivers the product.

If the webhook is down, nothing is lost — `revenue deliver --live` sweeps every
paid-but-undelivered order, and the daily workflow runs it.

## Daily / weekly loop

The GitHub Actions workflows do the mechanical parts. What is left for you:

**Daily (5 min)** — read the workflow summary. Act only on anomalies:
undelivered orders, amount mismatches, a failed sweep.

**Weekly (2–3 hrs)** — finish and publish one article from
`out/content/`. Send five personal outreach emails
(`revenue lead draft --email ... --offer ...`), edited by you. Reply to
everyone who replied.

**Monthly (30 min)** — `revenue status` and `revenue reconcile`. Compare
against the ramp in `revenue plan`. If you are two months behind the curve,
re-read "How you will know it is failing" in `docs/STRATEGY.md`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Webhook returns 401 | Secret mismatch | `RAZORPAY_WEBHOOK_SECRET` must equal the dashboard value exactly |
| Paid but not delivered | Webhook unreachable | `python -m revenue deliver --live` |
| `amount_mismatch` in status | Price changed after the link was made | Check the order against the dashboard before delivering |
| Money captured, not in bank | Settlement is T+2 | `python -m revenue reconcile` shows what actually settled |
| `MissingCredential` | `.env` not loaded | Run from the repo root, or export the variable |
