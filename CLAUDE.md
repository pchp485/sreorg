# Working in this repo

The money side of the IEEE automation work: offers, checkout, delivery, funnel
and reporting. Sibling to `ieee_vtools_automation`, which is the product being
sold.

## The rules that matter

**Never send and never charge without an explicit `--live` in the current
conversation.** Same two-phase discipline as the sibling repo: dry run, show
the output, get a yes, then run live. Approval does not carry over between
events.

**Never add a bulk email send function.** `leads.draft_outreach` deliberately
returns text for a human to send. The moment it can send by itself it is a spam
cannon, and the standing that makes this business work — a Section Chair
writing to peers — is destroyed the first time it is used that way. This is not
a limitation to be helpfully removed.

**Consent needs evidence.** `capture(consent=True)` without `evidence` raises,
on purpose. See `docs/COMPLIANCE.md` for why (DPDP, GDPR, CAN-SPAM).

**Money is integer paise, never float.** Half a rupee per order is invisible
until it is reconciled against a bank statement.

**Report net, not gross.** Gateway fees come off everywhere. `revenue status`
also separates MRR from one-off, because the target says *constant*.

## Commands

```bash
export PYTHONPATH=src

python -m revenue check                                  # credentials, contacts nothing
python -m revenue offers                                 # ladder + unit economics
python -m revenue plan                                   # gap analysis to target
python -m revenue status                                 # this month, net
python -m revenue sell <offer> --email <e> [--live]      # order + payment link
python -m revenue deliver [--order <id>] [--live]        # fulfil; omit --order to sweep
python -m revenue lead add --email <e> --source <s> [--consent --evidence "..."]
python -m revenue lead draft --email <e> --offer <slug>  # one personal message
python -m revenue content plan | draft [--live]
python -m revenue reconcile                              # database vs bank settlements
python -m revenue serve --port 8080                      # webhook receiver
```

`--json` on any command.

## Conventions

- **Stdlib only.** No dependencies, so it runs on a bare runner with no install
  step. Do not add a package without a strong reason; there is almost always a
  stdlib way at this scale.
- Secrets in `.env` (gitignored) or Actions secrets. Never in a file in the
  repo.
- `data/*.db` and `out/` are generated and gitignored.
- Prices and capacity live in `config/offers.json`, not in code. Changing a
  price should never need a code change.
- Every entry in `config/topics.json` must carry real `proof` — a specific
  thing built, measured or broken. The test suite enforces that it is
  non-trivial, because content without evidence converts at zero.

## When asked "how is it going"

Run `revenue status`, then compare against the ramp in `revenue plan`. Report
the gap plainly. Do not present a good month of one-off sales as if the target
were met — the target is *constant* revenue, which means MRR. `status` already
distinguishes these; say which one moved.
