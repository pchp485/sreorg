"""The nouns of the business.

Money is stored in paise (integer), never float. A rounding error that costs
half a rupee per order is invisible until it is reconciled against a bank
statement, and then it costs an evening.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def rupees(paise: int) -> str:
    return f"Rs {paise / 100:,.2f}"


class OfferKind(str, Enum):
    #: Bought once, delivered instantly, infinite supply. The only kind that
    #: genuinely earns while nobody is awake.
    DIGITAL = "digital"
    #: Bought once, delivered by a human. Caps out at the hours in a week.
    SERVICE = "service"
    #: Billed monthly. The only kind that makes revenue "constant".
    SUBSCRIPTION = "subscription"


class LeadStage(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    REPLIED = "replied"
    QUALIFIED = "qualified"
    WON = "won"
    LOST = "lost"


class OrderStatus(str, Enum):
    CREATED = "created"
    PAID = "paid"
    DELIVERED = "delivered"
    REFUNDED = "refunded"
    FAILED = "failed"


@dataclass
class Offer:
    """Something someone can pay for."""

    slug: str
    name: str
    kind: OfferKind
    price_paise: int
    #: Hours of human work per unit sold. 0.0 means it truly self-delivers.
    delivery_hours: float = 0.0
    #: How many can be sold per month before the constraint binds. None = no cap.
    monthly_capacity: int | None = None
    #: Direct cost per unit in paise (hosting, per-seat licences, printing).
    unit_cost_paise: int = 0
    description: str = ""
    #: Path, relative to the repo, of what gets sent on payment.
    deliverable: str = ""
    active: bool = True

    @property
    def is_recurring(self) -> bool:
        return self.kind is OfferKind.SUBSCRIPTION

    def net_paise(self, *, international: bool = False) -> int:
        """What actually lands in the bank per unit sold."""
        from .config import effective_fee

        gross = self.price_paise
        fee = round(gross * effective_fee(international))
        return gross - fee - self.unit_cost_paise

    def units_for(self, target_paise: int, *, international: bool = False) -> int:
        """Units per month needed to hit `target_paise` from this offer alone."""
        net = self.net_paise(international=international)
        if net <= 0:
            return 0
        import math

        return math.ceil(target_paise / net)


@dataclass
class Lead:
    email: str
    source: str
    name: str = ""
    org: str = ""
    stage: LeadStage = LeadStage.NEW
    #: Explicit opt-in is the difference between marketing and spam. No
    #: sequence touches a lead without it.
    consent: bool = False
    consent_evidence: str = ""
    notes: str = ""
    id: str = field(default_factory=lambda: new_id("lead"))
    created_at: str = field(default_factory=now)
    updated_at: str = field(default_factory=now)


@dataclass
class Order:
    offer_slug: str
    amount_paise: int
    email: str
    status: OrderStatus = OrderStatus.CREATED
    international: bool = False
    #: Razorpay's own ids, for reconciliation against the settlement report.
    gateway_order_id: str = ""
    gateway_payment_id: str = ""
    payment_link: str = ""
    delivered_at: str = ""
    id: str = field(default_factory=lambda: new_id("ord"))
    created_at: str = field(default_factory=now)
    updated_at: str = field(default_factory=now)

    def net_paise(self) -> int:
        from .config import effective_fee

        return self.amount_paise - round(self.amount_paise * effective_fee(self.international))
