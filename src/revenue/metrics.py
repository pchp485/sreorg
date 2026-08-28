"""Where the business actually is, as opposed to where it feels like it is.

Two rules here:
  - Report *net* (after gateway fee), never gross. Gross is a vanity number.
  - Separate recurring from one-off. The target says "constant"; a month that
    only hit the number because of a single lucky consulting sale has not hit
    the target, and reporting it as if it had is how the next month becomes a
    surprise.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from .catalog import get_offer, load_offers
from .config import Target
from .models import OfferKind, OrderStatus, rupees
from .store import active_subscriptions, count_events, list_leads, list_orders


def month_start(offset: int = 0) -> str:
    d = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    for _ in range(abs(offset)):
        d = (d - timedelta(days=1)).replace(day=1) if offset < 0 else d
    return d.isoformat(timespec="seconds")


def _offer_kind(slug: str) -> OfferKind:
    try:
        return get_offer(slug).kind
    except KeyError:
        return OfferKind.DIGITAL


def snapshot() -> dict:
    """The single view the daily report renders."""
    target = Target.load()
    target_paise = target.monthly_net_inr * 100
    since = month_start()

    orders = [
        o for o in list_orders(since=since)
        if o.status in (OrderStatus.PAID, OrderStatus.DELIVERED)
    ]

    by_offer: dict[str, dict] = defaultdict(lambda: {"units": 0, "net_paise": 0})
    one_off_net = 0
    for o in orders:
        net = o.net_paise()
        by_offer[o.offer_slug]["units"] += 1
        by_offer[o.offer_slug]["net_paise"] += net
        if _offer_kind(o.offer_slug) is not OfferKind.SUBSCRIPTION:
            one_off_net += net

    # MRR is the recurring base, independent of what sold this month.
    mrr_paise = 0
    for sub in active_subscriptions():
        from .config import effective_fee

        gross = int(sub["amount_paise"])
        mrr_paise += gross - round(gross * effective_fee(bool(sub["international"])))

    total_net = mrr_paise + one_off_net
    gap = max(0, target_paise - total_net)

    leads = list_leads()
    consented = [l for l in leads if l.consent]

    return {
        "as_of": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "target_inr": target.monthly_net_inr,
        "mrr_inr": mrr_paise / 100,
        "one_off_inr_this_month": one_off_net / 100,
        "total_net_inr_this_month": total_net / 100,
        "gap_to_target_inr": gap / 100,
        "pct_of_target": round(100 * total_net / target_paise, 1) if target_paise else 0.0,
        # The honest headline: is the recurring base alone enough?
        "constant_revenue_achieved": mrr_paise >= target_paise,
        "orders_this_month": len(orders),
        "by_offer": {
            k: {"units": v["units"], "net_inr": v["net_paise"] / 100}
            for k, v in sorted(by_offer.items())
        },
        "active_subscriptions": len(active_subscriptions()),
        "leads_total": len(leads),
        "leads_consented": len(consented),
        "visits_this_month": count_events("visit", since),
        "content_published_this_month": count_events("published", since),
    }


def report_text() -> str:
    s = snapshot()
    target = s["target_inr"]
    bar_width = 32
    filled = min(bar_width, int(bar_width * s["pct_of_target"] / 100))
    bar = "#" * filled + "." * (bar_width - filled)

    lines = [
        f"Revenue snapshot - {s['as_of'][:10]}",
        "=" * 52,
        f"  [{bar}] {s['pct_of_target']}% of Rs {target:,}/mo",
        "",
        f"  Recurring (MRR)        Rs {s['mrr_inr']:>10,.2f}",
        f"  One-off this month     Rs {s['one_off_inr_this_month']:>10,.2f}",
        f"  {'-' * 44}",
        f"  Total net this month   Rs {s['total_net_inr_this_month']:>10,.2f}",
        f"  Gap to target          Rs {s['gap_to_target_inr']:>10,.2f}",
        "",
        f"  Constant revenue achieved: "
        f"{'YES' if s['constant_revenue_achieved'] else 'not yet - MRR alone is below target'}",
        "",
        f"  Active subscriptions   {s['active_subscriptions']}",
        f"  Orders this month      {s['orders_this_month']}",
        f"  Leads (consented)      {s['leads_total']} ({s['leads_consented']})",
        f"  Visits this month      {s['visits_this_month']:.0f}",
        f"  Content published      {s['content_published_this_month']:.0f}",
    ]
    if s["by_offer"]:
        lines += ["", "  By offer:"]
        for slug, v in s["by_offer"].items():
            lines.append(f"    {slug:<24} {v['units']:>3} units   Rs {v['net_inr']:>9,.2f}")
    return "\n".join(lines)


def reconcile() -> dict:
    """Compare what the database believes against what Razorpay settled.

    Requires live credentials. The number that matters is `settled_inr`:
    money that has actually reached the bank account, which is always behind
    captured payments by the settlement cycle (T+2 for most accounts).
    """
    from .payments.razorpay import fetch_settlements

    data = fetch_settlements(count=20)
    items = data.get("items", [])
    settled = sum(int(i.get("amount", 0)) for i in items if i.get("status") == "processed")
    return {
        "settlements_seen": len(items),
        "settled_inr": settled / 100,
        "settled_display": rupees(settled),
        "note": "Settled = actually in the bank. Captured payments not yet "
                "settled are still held by the gateway.",
    }
