"""Delivery. The half of the sale that must never need a human awake.

A digital order that sits undelivered for eight hours because it was bought at
2am is a refund request by breakfast. So `deliver` runs inside the webhook
path, synchronously, and the daily sweep exists only to catch what that missed.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from pathlib import Path

from .catalog import get_offer
from .config import REPO_ROOT, env
from .models import Order, OrderStatus, OfferKind, now, rupees
from .store import list_orders, record_event, save_order


class DeliveryError(RuntimeError):
    pass


def _smtp_send(to: str, subject: str, body: str) -> None:
    host = env("SMTP_HOST", required=True)
    port = int(env("SMTP_PORT", "587"))
    user = env("SMTP_USER", required=True)
    password = env("SMTP_PASSWORD", required=True)
    sender = env("SENDER_EMAIL", user)

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)


def render_delivery(order: Order) -> tuple[str, str]:
    """The email a buyer gets. Returned rather than sent, so it can be shown."""
    offer = get_offer(order.offer_slug)
    access = env("DELIVERY_BASE_URL", "https://example.invalid/deliverables")
    link = f"{access.rstrip('/')}/{offer.slug}?order={order.id}"

    subject = f"Your {offer.name}"
    if offer.kind is OfferKind.SUBSCRIPTION:
        body = f"""Hello,

Your subscription to {offer.name} is active.

  Amount   {rupees(order.amount_paise)} / month
  Order    {order.id}
  Start    {now()[:10]}

Onboarding, and what I need from you to run the first event:
  {link}

Approval always stays with you. Nothing is published to your section's
vTools, website or LinkedIn without your explicit yes on that specific
item - the automation proposes, you decide.

Reply to this email to cancel at any time; it takes effect from the next
billing month and there is no notice period.

- Harish
"""
    else:
        body = f"""Hello,

Thank you - here is your copy of {offer.name}.

  Download  {link}
  Order     {order.id}
  Amount    {rupees(order.amount_paise)}

The link does not expire. If it ever stops working, reply to this email
with the order id above and I will send a fresh one.

If it is not useful to you, reply within 14 days and I will refund it in
full, no questions and no form to fill in.

- Harish
"""
    return subject, body


def deliver(order: Order, *, live: bool = False) -> dict:
    """Fulfil a paid order. Idempotent: a delivered order is never sent twice."""
    if order.status is OrderStatus.DELIVERED:
        return {"order": order.id, "skipped": "already delivered"}
    if order.status is not OrderStatus.PAID:
        raise DeliveryError(
            f"Refusing to deliver {order.id}: status is '{order.status.value}', not 'paid'."
        )

    subject, body = render_delivery(order)

    if not live:
        return {"order": order.id, "dry_run": True, "subject": subject, "body": body}

    _smtp_send(order.email, subject, body)
    order.status = OrderStatus.DELIVERED
    order.delivered_at = now()
    save_order(order)
    record_event("delivered", order.offer_slug, 1, order.id)
    return {"order": order.id, "delivered_to": order.email, "subject": subject}


def sweep(*, live: bool = False) -> list[dict]:
    """Catch orders that were paid but never delivered.

    Runs on a schedule. It should always find nothing; when it finds
    something, the webhook path has a bug worth chasing.
    """
    results = []
    for order in list_orders(status=OrderStatus.PAID):
        try:
            results.append(deliver(order, live=live))
        except Exception as exc:  # noqa: BLE001 - one bad order must not stop the rest
            results.append({"order": order.id, "error": str(exc)})
    return results
