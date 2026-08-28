"""The offer ladder, loaded from config/offers.json."""

from __future__ import annotations

import json
from functools import lru_cache

from .config import CONFIG_DIR
from .models import Offer, OfferKind


@lru_cache(maxsize=1)
def _raw() -> dict:
    return json.loads((CONFIG_DIR / "offers.json").read_text(encoding="utf-8"))


def load_offers(include_inactive: bool = False) -> list[Offer]:
    offers = []
    for item in _raw()["offers"]:
        item = {k: v for k, v in item.items() if not k.startswith("_")}
        item["kind"] = OfferKind(item["kind"])
        offer = Offer(**item)
        if offer.active or include_inactive:
            offers.append(offer)
    return offers


def get_offer(slug: str) -> Offer:
    for offer in load_offers(include_inactive=True):
        if offer.slug == slug:
            return offer
    known = ", ".join(o.slug for o in load_offers())
    raise KeyError(f"No offer '{slug}'. Known offers: {known}")


def reload() -> None:
    """Drop the cache; used by tests and after editing offers.json."""
    _raw.cache_clear()
