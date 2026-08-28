"""One entry point for the whole engine.

    python -m revenue <command>

Every command that can move money or send mail is dry by default and needs an
explicit --live. That is the same rule the IEEE toolkit uses, for the same
reason: the cost of an accidental send is much higher than the cost of typing
five more characters.
"""

from __future__ import annotations

import argparse
import json
import sys

from . import __version__
from .catalog import get_offer, load_offers
from .models import Lead, LeadStage, Order, OrderStatus, rupees
from .store import get_order, list_orders, save_order


def _out(data, as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2, default=str))
    elif isinstance(data, str):
        print(data)
    else:
        print(json.dumps(data, indent=2, default=str))


# --- commands --------------------------------------------------------------

def cmd_offers(args) -> int:
    offers = load_offers(include_inactive=args.all)
    if args.json:
        _out([{
            "slug": o.slug, "name": o.name, "kind": o.kind.value,
            "price_inr": o.price_paise / 100, "net_inr": o.net_paise() / 100,
            "delivery_hours": o.delivery_hours, "capacity": o.monthly_capacity,
            "units_for_target": o.units_for(30000 * 100),
        } for o in offers], True)
        return 0
    print(f"{'slug':<24}{'kind':<14}{'price':>13}{'net of fees':>14}"
          f"{'hrs/unit':>10}{'for 30k':>9}")
    print("-" * 84)
    for o in offers:
        print(f"{o.slug:<24}{o.kind.value:<14}{rupees(o.price_paise):>13}"
              f"{rupees(o.net_paise()):>14}{o.delivery_hours:>10.1f}"
              f"{o.units_for(30000 * 100):>9}")
    return 0


def cmd_plan(args) -> int:
    from .plan import build_plan, ramp

    plan = build_plan()
    if args.json:
        _out({"plan": plan, "ramp": ramp()}, True)
        return 0

    print(f"Target: Rs {plan['target_inr_per_month']:,}/month net, "
          f"within {plan['horizon_months']} months")
    print(f"Delivery capacity assumed: {plan['delivery_hours_budget']:.0f} hrs/month\n")

    print("Single-offer paths (cheapest in hours first):")
    for p in plan["single_offer_paths"]:
        units = ", ".join(f"{v} x {k}" for k, v in p["units"].items())
        print(f"  {units:<40} Rs {p['net_inr']:>7,}  {p['delivery_hours']:>4.1f} hrs")

    rec = plan["recommended_mix"]
    print("\nRecommended mix (subscription-led, because the goal is *constant*):")
    if not rec:
        print("  UNREACHABLE with the current ladder and hour budget.")
        print("  Raise a price, add capacity, or extend the horizon.")
        return 1
    print(f"  {rec['describe']}")
    print(f"  -> Rs {rec['net_inr']:,}/month net at {rec['delivery_hours']:.0f} hrs/month")

    tr = plan["traffic_required"]
    if tr:
        print(f"\n  Traffic that implies: ~{tr['_total_monthly_visits']:,} visits/month")
        for slug, v in tr.items():
            if slug.startswith("_"):
                continue
            print(f"    {slug:<24} {v['units']:>2} sales <- {v['leads']:>4} leads "
                  f"<- {v['visits']:>6,} visits")
        print("\n  That traffic number is the real work. Everything else here is")
        print("  plumbing that already exists.")

    print("\nExpected ramp (month one earns nothing; that is normal):")
    for r in ramp():
        print(f"  {r['month']}   Rs {r['expected_net_inr']:>7,}   {r['pct_of_target']:>3}%")
    return 0


def cmd_status(args) -> int:
    from .metrics import report_text, snapshot

    _out(snapshot() if args.json else report_text(), args.json)
    return 0


def cmd_sell(args) -> int:
    """Create an order and a Razorpay payment link for it."""
    offer = get_offer(args.offer)
    order = Order(offer_slug=offer.slug, amount_paise=offer.price_paise,
                  email=args.email, international=args.international)

    if not args.live:
        _out({"dry_run": True, "order": order.id, "offer": offer.slug,
              "amount": rupees(order.amount_paise),
              "net_after_fees": rupees(order.net_paise()),
              "next": "re-run with --live to create the real payment link"}, args.json)
        return 0

    from .payments.razorpay import create_payment_link

    link = create_payment_link(
        amount_paise=offer.price_paise,
        description=offer.name,
        customer_email=args.email,
        reference_id=order.id,
        notes={"order_ref": order.id, "offer_slug": offer.slug},
    )
    order.gateway_order_id = link.get("id", "")
    order.payment_link = link.get("short_url", "")
    save_order(order)
    _out({"order": order.id, "pay_at": order.payment_link,
          "amount": rupees(order.amount_paise)}, args.json)
    return 0


def cmd_deliver(args) -> int:
    from .fulfil import deliver, sweep

    if args.order:
        order = get_order(args.order)
        if not order:
            print(f"No order {args.order}", file=sys.stderr)
            return 1
        _out(deliver(order, live=args.live), args.json)
    else:
        _out(sweep(live=args.live), args.json)
    return 0


def cmd_lead(args) -> int:
    from .leads import capture, draft_outreach, mailable

    if args.action == "add":
        lead = capture(args.email, args.source, name=args.name or "", org=args.org or "",
                       consent=args.consent, evidence=args.evidence or "")
        _out({"lead": lead.id, "email": lead.email, "consent": lead.consent}, args.json)
    elif args.action == "list":
        from .store import list_leads
        rows = [{"email": l.email, "org": l.org, "stage": l.stage.value,
                 "consent": l.consent, "source": l.source} for l in list_leads()]
        if args.json:
            _out(rows, True)
        else:
            for r in rows:
                print(f"  {r['email']:<34}{r['org'][:18]:<20}{r['stage']:<12}"
                      f"{'opted-in' if r['consent'] else 'no consent'}")
    elif args.action == "mailable":
        _out([l.email for l in mailable()], args.json)
    elif args.action == "draft":
        from .store import list_leads
        matches = [l for l in list_leads() if l.email == (args.email or "").lower()]
        if not matches:
            print(f"No lead {args.email}", file=sys.stderr)
            return 1
        draft = draft_outreach(matches[0], args.offer)
        print(draft.render())
        print("\n[not sent - copy, edit, and send this yourself]")
    return 0


def cmd_content(args) -> int:
    from .content import generate, plan_content

    if args.action == "plan":
        rows = plan_content(weeks=args.weeks)
        if args.json:
            _out(rows, True)
        else:
            for r in rows:
                print(f"  week {r['week']:>2}: {r['title']}")
                print(f"            -> {r['offer']}")
    else:
        _out(generate(live=args.live), args.json)
    return 0


def cmd_serve(args) -> int:
    from .payments.webhook import serve

    serve(port=args.port)
    return 0


def cmd_reconcile(args) -> int:
    from .metrics import reconcile

    _out(reconcile(), args.json)
    return 0


def cmd_check(args) -> int:
    """Preflight every credential without changing anything."""
    from .config import env

    required = {
        "RAZORPAY_KEY_ID": "create payment links",
        "RAZORPAY_KEY_SECRET": "create payment links, verify checkout",
        "RAZORPAY_WEBHOOK_SECRET": "verify incoming webhooks",
        "SMTP_HOST": "deliver purchases",
        "SMTP_USER": "deliver purchases",
        "SMTP_PASSWORD": "deliver purchases",
        "DELIVERY_BASE_URL": "where buyers download what they bought",
    }
    missing = []
    print("Credential preflight (nothing is contacted):\n")
    for name, why in required.items():
        val = env(name)
        mark = "ok  " if val else "MISS"
        print(f"  [{mark}] {name:<26} {why}")
        if not val:
            missing.append(name)

    print(f"\n{len(required) - len(missing)}/{len(required)} configured.")
    if missing:
        print("\nUntil these are set the engine can still plan, draft content and")
        print("track leads - it just cannot take money or deliver:")
        for name in missing:
            print(f"  - {name}")
        return 1
    print("Ready to take money.")
    return 0


# --- wiring ----------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="revenue", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--version", action="version", version=f"revenue {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    def add(name, fn, help_):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--json", action="store_true", help="machine-readable output")
        s.set_defaults(func=fn)
        return s

    s = add("offers", cmd_offers, "list the offer ladder and its unit economics")
    s.add_argument("--all", action="store_true", help="include inactive offers")

    add("plan", cmd_plan, "shortest honest path to the target")
    add("status", cmd_status, "where revenue actually is this month")
    add("reconcile", cmd_reconcile, "compare the database against bank settlements")
    add("check", cmd_check, "preflight credentials, change nothing")

    s = add("sell", cmd_sell, "create an order and payment link")
    s.add_argument("offer")
    s.add_argument("--email", required=True)
    s.add_argument("--international", action="store_true")
    s.add_argument("--live", action="store_true", help="actually create the link")

    s = add("deliver", cmd_deliver, "fulfil paid orders")
    s.add_argument("--order", help="one order; omit to sweep all paid-undelivered")
    s.add_argument("--live", action="store_true", help="actually send the email")

    s = add("lead", cmd_lead, "capture and work leads")
    s.add_argument("action", choices=["add", "list", "mailable", "draft"])
    s.add_argument("--email")
    s.add_argument("--source", default="manual")
    s.add_argument("--name")
    s.add_argument("--org")
    s.add_argument("--offer", default="section-ops-kit")
    s.add_argument("--consent", action="store_true", help="they explicitly opted in")
    s.add_argument("--evidence", help="where and when they opted in (required with --consent)")

    s = add("content", cmd_content, "plan and draft the top-of-funnel")
    s.add_argument("action", choices=["plan", "draft"])
    s.add_argument("--weeks", type=int, default=8)
    s.add_argument("--live", action="store_true", help="mark as published")

    s = add("serve", cmd_serve, "run the payment webhook receiver")
    s.add_argument("--port", type=int, default=8080)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
