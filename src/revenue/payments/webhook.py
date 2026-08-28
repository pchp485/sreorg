"""Webhook receiver: the one endpoint that turns a payment into a delivery.

A stdlib http.server, not FastAPI. It handles a handful of requests a day and
this way the whole system installs with `git clone` and nothing else.

Run it anywhere with a public URL - a free-tier VM, a Cloudflare tunnel, or a
Render/Fly free instance. See docs/RUNBOOK.md for the tunnel one-liner.
"""

from __future__ import annotations

import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer

from ..fulfil import deliver
from ..models import Order, OrderStatus, now
from ..store import (
    already_processed,
    find_order_by_gateway,
    mark_processed,
    record_event,
    save_order,
)
from .razorpay import verify_webhook

log = logging.getLogger("revenue.webhook")

#: Events worth acting on. Anything else is acknowledged and dropped, because
#: a 200 with no action is how you stop a gateway retrying forever.
HANDLED = {"payment_link.paid", "payment.captured", "subscription.charged"}


def handle_event(payload: dict, *, live: bool = True) -> dict:
    event = payload.get("event", "")
    if event not in HANDLED:
        return {"ignored": event}

    entity = payload.get("payload", {})
    payment = entity.get("payment", {}).get("entity", {})
    link = entity.get("payment_link", {}).get("entity", {})

    reference = link.get("reference_id") or payment.get("notes", {}).get("order_ref", "")
    gateway_order_id = payment.get("order_id") or link.get("id", "")
    amount = int(payment.get("amount") or link.get("amount") or 0)
    email = (
        payment.get("email")
        or link.get("customer", {}).get("email")
        or ""
    )

    order = None
    if reference:
        from ..store import get_order

        order = get_order(reference)
    if order is None and gateway_order_id:
        order = find_order_by_gateway(gateway_order_id)

    if order is None:
        # A payment with no matching local order still represents real money.
        # Record it rather than dropping it; reconciliation will surface it.
        order = Order(
            offer_slug=payment.get("notes", {}).get("offer_slug", "unknown"),
            amount_paise=amount,
            email=email,
            gateway_order_id=gateway_order_id,
            gateway_payment_id=payment.get("id", ""),
        )
        log.warning("Payment %s had no matching local order; created %s",
                    payment.get("id"), order.id)

    # Never trust the webhook's amount over the order's own price for
    # anything but reconciliation - but do flag a mismatch loudly.
    if amount and order.amount_paise and amount != order.amount_paise:
        record_event("amount_mismatch", order.id, 1,
                     f"expected={order.amount_paise} got={amount}")
        log.error("Amount mismatch on %s: expected %s, webhook said %s",
                  order.id, order.amount_paise, amount)

    order.gateway_payment_id = payment.get("id", order.gateway_payment_id)
    order.gateway_order_id = gateway_order_id or order.gateway_order_id
    if order.status in (OrderStatus.CREATED, OrderStatus.FAILED):
        order.status = OrderStatus.PAID
    order.updated_at = now()
    save_order(order)
    record_event("paid", order.offer_slug, order.amount_paise / 100, order.id)

    result = deliver(order, live=live)
    return {"event": event, "order": order.id, "delivery": result}


class Handler(BaseHTTPRequestHandler):
    server_version = "revenue-webhook/0.1"

    def _reply(self, code: int, body: dict) -> None:
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler's naming
        if self.path.rstrip("/") in ("/health", ""):
            self._reply(200, {"ok": True})
        else:
            self._reply(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        signature = self.headers.get("X-Razorpay-Signature", "")

        if not verify_webhook(body, signature):
            log.warning("Rejected webhook with bad signature from %s", self.client_address[0])
            self._reply(401, {"error": "bad signature"})
            return

        # The signature doubles as the dedupe key: the gateway retries the
        # identical body, so the identical HMAC comes back with it.
        if already_processed(signature):
            self._reply(200, {"ok": True, "duplicate": True})
            return

        try:
            payload = json.loads(body.decode())
            result = handle_event(payload)
            mark_processed(signature, payload.get("id", ""))
            self._reply(200, {"ok": True, "result": result})
        except Exception as exc:  # noqa: BLE001
            # Do NOT mark processed: a 500 makes the gateway retry, which is
            # what should happen when delivery genuinely failed.
            log.exception("Webhook processing failed")
            self._reply(500, {"error": str(exc)})

    def log_message(self, fmt: str, *args) -> None:
        log.info("%s - %s", self.client_address[0], fmt % args)


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("Webhook listening on %s:%s", host, port)
    HTTPServer((host, port), Handler).serve_forever()
