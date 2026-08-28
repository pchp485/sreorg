"""Razorpay client.

Razorpay because it settles directly to an Indian current/savings account in
INR, needs no company to start (individual/proprietor onboarding with PAN +
bank proof), charges nothing up front, and supports UPI - which is how Indian
buyers actually pay. Stripe is not an option for an India-domiciled seller
without a registered entity.

For customers outside India, see docs/MONEY_RAILS.md: international collection
is a different product with different KYC and a purpose-code obligation, and
pretending otherwise creates an FX compliance problem rather than revenue.

Only stdlib. `urllib` is unpleasant but it is one less thing to install on a
runner, and this module makes perhaps a dozen calls a day.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
from typing import Any

from ..config import env

API_BASE = "https://api.razorpay.com/v1"


class RazorpayError(RuntimeError):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"Razorpay returned HTTP {status}: {body[:400]}")
        self.status = status
        self.body = body


def _auth_header() -> str:
    key = env("RAZORPAY_KEY_ID", required=True)
    secret = env("RAZORPAY_KEY_SECRET", required=True)
    token = base64.b64encode(f"{key}:{secret}".encode()).decode()
    return f"Basic {token}"


def _request(method: str, path: str, payload: dict | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", _auth_header())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raise RazorpayError(exc.code, exc.read().decode(errors="replace")) from exc


def create_payment_link(
    *,
    amount_paise: int,
    description: str,
    customer_email: str = "",
    customer_name: str = "",
    reference_id: str = "",
    callback_url: str = "",
    notes: dict | None = None,
) -> dict[str, Any]:
    """A hosted checkout page. No website or PCI scope needed to take money.

    This is the fastest possible path from "someone wants to buy" to "rupees
    are in the account": the link works in a DM, an email, or a QR code.
    """
    payload: dict[str, Any] = {
        "amount": amount_paise,
        "currency": "INR",
        "description": description[:2048],
        "notify": {"sms": False, "email": bool(customer_email)},
        "reminder_enable": True,
        "notes": notes or {},
    }
    if reference_id:
        payload["reference_id"] = reference_id
    if customer_email or customer_name:
        payload["customer"] = {
            k: v for k, v in {"email": customer_email, "name": customer_name}.items() if v
        }
    if callback_url:
        payload["callback_url"] = callback_url
        payload["callback_method"] = "get"
    return _request("POST", "/payment_links", payload)


def fetch_payment(payment_id: str) -> dict[str, Any]:
    return _request("GET", f"/payments/{payment_id}")


def fetch_settlements(count: int = 20) -> dict[str, Any]:
    """Settlements are the ground truth for 'did money reach the bank'.

    A captured payment is not money in the account; it is money Razorpay is
    holding. Reconciliation reads this, never the payments list.
    """
    return _request("GET", f"/settlements?count={count}")


def verify_webhook(body: bytes, signature: str, secret: str | None = None) -> bool:
    """Constant-time HMAC-SHA256 check on a webhook payload.

    Skipping this is how a stranger POSTs "payment.captured" and gets a paid
    product delivered for free. The comparison is `compare_digest` rather than
    `==` so the check does not leak the expected digest by timing.
    """
    secret = secret or env("RAZORPAY_WEBHOOK_SECRET", required=True)
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (signature or "").strip())


def verify_payment_signature(
    order_id: str, payment_id: str, signature: str, secret: str | None = None
) -> bool:
    """Checkout callback verification: HMAC over "order_id|payment_id"."""
    secret = secret or env("RAZORPAY_KEY_SECRET", required=True)
    expected = hmac.new(
        secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, (signature or "").strip())
