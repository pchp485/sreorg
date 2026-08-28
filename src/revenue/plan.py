"""The gap planner.

Answers the only question that matters month to month: given what is actually
selling right now, what is the shortest honest path to the target?

It is deliberately pessimistic. It refuses mixes that need more delivery hours
than exist, and it will say a target is unreachable rather than produce a
flattering number.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .catalog import load_offers
from .config import CONFIG_DIR, Target
from .models import Offer, OfferKind, rupees


def _settings() -> dict:
    path = CONFIG_DIR / "targets.json"
    raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {k: v for k, v in raw.items() if not k.startswith("_")}


@dataclass
class Mix:
    """A concrete combination of monthly unit sales that reaches the target."""

    units: dict[str, int]
    net_paise: int
    delivery_hours: float
    label: str

    def describe(self, offers: dict[str, Offer]) -> str:
        parts = [
            f"{n} x {offers[slug].name} ({rupees(offers[slug].price_paise)})"
            for slug, n in self.units.items() if n
        ]
        return " + ".join(parts) if parts else "nothing"


def single_offer_mixes(target_paise: int, hours_budget: float) -> list[Mix]:
    """For each offer alone: how many units, and does it fit in the hours?"""
    mixes = []
    for offer in load_offers():
        units = offer.units_for(target_paise)
        if units == 0:
            continue
        if offer.monthly_capacity is not None and units > offer.monthly_capacity:
            continue
        hours = units * offer.delivery_hours
        if hours > hours_budget:
            continue
        mixes.append(
            Mix(
                units={offer.slug: units},
                net_paise=units * offer.net_paise(),
                delivery_hours=hours,
                label=f"{offer.slug} only",
            )
        )
    return mixes


def blended_mix(target_paise: int, hours_budget: float) -> Mix | None:
    """A realistic mix: fill from the subscription rung first, then digital.

    Subscriptions first because the target says *constant*. One-off sales that
    happen to total the target in a good month are not the same thing, and
    treating them as if they were is how people talk themselves into believing
    a business is stable when it is not.
    """
    offers = {o.slug: o for o in load_offers()}
    units: dict[str, int] = {slug: 0 for slug in offers}
    net = 0
    hours = 0.0

    ordered = sorted(
        offers.values(),
        key=lambda o: (
            0 if o.kind is OfferKind.SUBSCRIPTION else 1 if o.kind is OfferKind.DIGITAL else 2,
            o.delivery_hours,
        ),
    )

    for offer in ordered:
        if net >= target_paise:
            break
        unit_net = offer.net_paise()
        if unit_net <= 0:
            continue
        need = math.ceil((target_paise - net) / unit_net)
        cap = offer.monthly_capacity if offer.monthly_capacity is not None else need
        # Subscriptions ramp; assume no more than half the cap is realistic in
        # a single planning month.
        if offer.kind is OfferKind.SUBSCRIPTION and offer.monthly_capacity:
            cap = min(cap, max(1, offer.monthly_capacity // 2))
        affordable = int((hours_budget - hours) // offer.delivery_hours) if offer.delivery_hours else need
        take = max(0, min(need, cap, affordable))
        if not take:
            continue
        units[offer.slug] = take
        net += take * unit_net
        hours += take * offer.delivery_hours

    if net < target_paise:
        return None
    return Mix(units=units, net_paise=net, delivery_hours=hours, label="blended (subscription-led)")


def traffic_required(units: int, kind: OfferKind) -> dict[str, int]:
    """Work backwards from units sold to visitors needed."""
    s = _settings()
    v2l = s.get("assumed_visit_to_lead", 0.02)
    l2s = (
        s.get("assumed_lead_to_sale_service", 0.05)
        if kind in (OfferKind.SERVICE, OfferKind.SUBSCRIPTION)
        else s.get("assumed_lead_to_sale_digital", 0.02)
    )
    leads = math.ceil(units / l2s) if l2s else 0
    visits = math.ceil(leads / v2l) if v2l else 0
    return {"units": units, "leads": leads, "visits": visits}


def build_plan() -> dict:
    target = Target.load()
    s = _settings()
    hours = float(s.get("delivery_hours_per_month", 20))
    target_paise = target.monthly_net_inr * 100
    offers = {o.slug: o for o in load_offers()}

    singles = single_offer_mixes(target_paise, hours)
    blend = blended_mix(target_paise, hours)

    funnel = {}
    if blend:
        total_visits = 0
        for slug, n in blend.units.items():
            if not n:
                continue
            need = traffic_required(n, offers[slug].kind)
            funnel[slug] = need
            total_visits += need["visits"]
        funnel["_total_monthly_visits"] = total_visits

    return {
        "target_inr_per_month": target.monthly_net_inr,
        "horizon_months": target.horizon_months,
        "delivery_hours_budget": hours,
        "single_offer_paths": [
            {
                "label": m.label,
                "units": m.units,
                "net_inr": m.net_paise // 100,
                "delivery_hours": m.delivery_hours,
            }
            for m in sorted(singles, key=lambda m: m.delivery_hours)
        ],
        "recommended_mix": None
        if not blend
        else {
            "units": {k: v for k, v in blend.units.items() if v},
            "net_inr": blend.net_paise // 100,
            "delivery_hours": blend.delivery_hours,
            "describe": blend.describe(offers),
        },
        "traffic_required": funnel,
        "reachable": blend is not None,
    }


def ramp(months: int | None = None) -> list[dict]:
    """A month-by-month ramp that respects how slowly trust actually accrues.

    The curve is not a hockey stick. Month one sells nothing; that is the
    normal shape of it, not a failure.
    """
    target = Target.load()
    months = months or target.horizon_months
    target_paise = target.monthly_net_inr * 100
    start = datetime.now(timezone.utc).replace(day=1)

    # Fraction of target expected by end of each month. Slow start, because
    # every one of these businesses starts with an audience of zero.
    curve = [0.0, 0.05, 0.18, 0.40, 0.65, 0.85, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    rows = []
    for i in range(months):
        frac = curve[min(i, len(curve) - 1)]
        month = (start + timedelta(days=32 * i)).strftime("%Y-%m")
        rows.append(
            {
                "month": month,
                "expected_net_inr": int(target_paise * frac) // 100,
                "pct_of_target": round(frac * 100),
            }
        )
    return rows
