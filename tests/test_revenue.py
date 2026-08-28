"""Tests for the parts where a bug costs money or credibility.

Run: PYTHONPATH=src python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


class TempDB(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        os.environ["REVENUE_DB"] = str(Path(self._tmp.name) / "t.db")
        # config.DB_PATH is read at import time, so rebind it for the test.
        import revenue.config as cfg
        import revenue.store as store
        cfg.DB_PATH = Path(os.environ["REVENUE_DB"])
        store.DB_PATH = cfg.DB_PATH

    def tearDown(self) -> None:
        self._tmp.cleanup()
        os.environ.pop("REVENUE_DB", None)


class TestMoneyMath(unittest.TestCase):
    def test_net_is_less_than_gross(self):
        from revenue.catalog import get_offer
        o = get_offer("agent-ops-playbook")
        self.assertLess(o.net_paise(), o.price_paise)

    def test_international_costs_more(self):
        from revenue.catalog import get_offer
        o = get_offer("agent-ops-playbook")
        self.assertLess(o.net_paise(international=True), o.net_paise())

    def test_fee_includes_gst_on_the_fee(self):
        from revenue.config import effective_fee
        self.assertAlmostEqual(effective_fee(), 0.02 * 1.18, places=6)

    def test_units_for_target_rounds_up(self):
        """20.1 units must be 21, never 20 - the target is a floor."""
        from revenue.catalog import get_offer
        o = get_offer("section-ops-kit")
        units = o.units_for(30_000 * 100)
        self.assertGreaterEqual(units * o.net_paise(), 30_000 * 100)

    def test_no_float_money(self):
        from revenue.catalog import load_offers
        for o in load_offers():
            self.assertIsInstance(o.price_paise, int, f"{o.slug} price must be integer paise")
            self.assertIsInstance(o.net_paise(), int)


class TestWebhookSecurity(unittest.TestCase):
    SECRET = "whsec_example"
    BODY = b'{"event":"payment.captured","id":"evt_1"}'

    def _sig(self, body: bytes, secret: str) -> str:
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    def test_valid_signature_accepted(self):
        from revenue.payments.razorpay import verify_webhook
        self.assertTrue(verify_webhook(self.BODY, self._sig(self.BODY, self.SECRET), self.SECRET))

    def test_forged_signature_rejected(self):
        from revenue.payments.razorpay import verify_webhook
        self.assertFalse(verify_webhook(self.BODY, "0" * 64, self.SECRET))

    def test_tampered_body_rejected(self):
        from revenue.payments.razorpay import verify_webhook
        sig = self._sig(self.BODY, self.SECRET)
        self.assertFalse(verify_webhook(self.BODY + b" ", sig, self.SECRET))

    def test_wrong_secret_rejected(self):
        from revenue.payments.razorpay import verify_webhook
        self.assertFalse(verify_webhook(self.BODY, self._sig(self.BODY, "other"), self.SECRET))

    def test_empty_signature_rejected(self):
        from revenue.payments.razorpay import verify_webhook
        self.assertFalse(verify_webhook(self.BODY, "", self.SECRET))

    def test_checkout_signature_binds_both_ids(self):
        from revenue.payments.razorpay import verify_payment_signature
        sig = hmac.new(b"ks", b"order_1|pay_1", hashlib.sha256).hexdigest()
        self.assertTrue(verify_payment_signature("order_1", "pay_1", sig, "ks"))
        self.assertFalse(verify_payment_signature("order_2", "pay_1", sig, "ks"))
        self.assertFalse(verify_payment_signature("order_1", "pay_2", sig, "ks"))


class TestOrderLifecycle(TempDB):
    def _order(self):
        from revenue.catalog import get_offer
        from revenue.models import Order
        from revenue.store import save_order
        o = get_offer("section-ops-kit")
        return save_order(Order(offer_slug=o.slug, amount_paise=o.price_paise,
                                email="b@example.com", gateway_order_id="order_X"))

    def test_webhook_marks_paid_and_delivers(self):
        from revenue.payments.webhook import handle_event
        from revenue.store import get_order
        order = self._order()
        payload = {"event": "payment.captured", "payload": {"payment": {"entity": {
            "id": "pay_1", "order_id": "order_X", "amount": order.amount_paise,
            "email": "b@example.com", "notes": {"order_ref": order.id}}}}}
        result = handle_event(payload, live=False)
        self.assertEqual(result["order"], order.id)
        self.assertEqual(get_order(order.id).status.value, "paid")

    def test_unknown_event_ignored(self):
        from revenue.payments.webhook import handle_event
        self.assertIn("ignored", handle_event({"event": "payment.failed"}, live=False))

    def test_amount_mismatch_is_recorded(self):
        from revenue.payments.webhook import handle_event
        from revenue.store import count_events
        order = self._order()
        payload = {"event": "payment.captured", "payload": {"payment": {"entity": {
            "id": "pay_1", "order_id": "order_X", "amount": 100,
            "email": "b@example.com", "notes": {"order_ref": order.id}}}}}
        handle_event(payload, live=False)
        self.assertEqual(count_events("amount_mismatch"), 1.0)

    def test_delivery_refuses_unpaid_order(self):
        from revenue.fulfil import DeliveryError, deliver
        order = self._order()
        with self.assertRaises(DeliveryError):
            deliver(order, live=False)

    def test_webhook_dedupe(self):
        from revenue.store import already_processed, mark_processed
        self.assertFalse(already_processed("sig"))
        mark_processed("sig")
        mark_processed("sig")   # replaying must not raise
        self.assertTrue(already_processed("sig"))


class TestConsent(TempDB):
    def test_consent_without_evidence_refused(self):
        from revenue.leads import ConsentError, capture
        with self.assertRaises(ConsentError):
            capture("x@example.com", "blog", consent=True)

    def test_consent_with_evidence_accepted(self):
        from revenue.leads import capture
        lead = capture("x@example.com", "blog", consent=True, evidence="form 2026-08-28")
        self.assertTrue(lead.consent)

    def test_mailable_excludes_non_consented(self):
        from revenue.leads import capture, mailable
        capture("no@example.com", "scraped")
        capture("yes@example.com", "blog", consent=True, evidence="signup form")
        self.assertEqual([l.email for l in mailable()], ["yes@example.com"])

    def test_bad_email_rejected(self):
        from revenue.leads import capture
        with self.assertRaises(ValueError):
            capture("not-an-email", "blog")

    def test_leads_dedupe_by_email(self):
        from revenue.leads import capture
        from revenue.store import list_leads
        capture("Dup@Example.com", "blog")
        capture("dup@example.com", "linkedin", name="Second")
        self.assertEqual(len(list_leads()), 1)


class TestPlanner(unittest.TestCase):
    def test_plan_is_reachable_and_within_hours(self):
        from revenue.plan import build_plan
        p = build_plan()
        self.assertTrue(p["reachable"])
        self.assertLessEqual(p["recommended_mix"]["delivery_hours"],
                             p["delivery_hours_budget"])

    def test_recommended_mix_actually_clears_the_target(self):
        from revenue.plan import build_plan
        p = build_plan()
        self.assertGreaterEqual(p["recommended_mix"]["net_inr"], p["target_inr_per_month"])

    def test_ramp_starts_at_zero(self):
        """A plan that promises revenue in month one is lying."""
        from revenue.plan import ramp
        self.assertEqual(ramp()[0]["expected_net_inr"], 0)

    def test_single_offer_paths_respect_capacity(self):
        from revenue.catalog import get_offer
        from revenue.plan import build_plan
        for path in build_plan()["single_offer_paths"]:
            for slug, units in path["units"].items():
                cap = get_offer(slug).monthly_capacity
                if cap is not None:
                    self.assertLessEqual(units, cap)


class TestContent(unittest.TestCase):
    def test_every_topic_has_proof(self):
        """Content with no specific evidence behind it converts at zero."""
        from revenue.content import load_topics
        for t in load_topics():
            self.assertTrue(t.proof.strip(), f"{t.slug} has no proof")
            self.assertGreater(len(t.proof), 40, f"{t.slug} proof is too thin")

    def test_every_topic_points_at_a_real_offer(self):
        from revenue.catalog import get_offer
        from revenue.content import load_topics
        for t in load_topics():
            get_offer(t.offer)   # raises KeyError if the slug is wrong


class TestCLI(unittest.TestCase):
    def test_readonly_commands_run_without_credentials(self):
        """plan/offers must work on a laptop with an empty .env."""
        from revenue.cli import main
        for argv in (["offers", "--json"], ["plan", "--json"], ["content", "plan", "--json"]):
            self.assertEqual(main(argv), 0, f"{argv} failed")

    def test_sell_is_dry_by_default(self):
        from revenue.cli import main
        self.assertEqual(main(["sell", "section-ops-kit", "--email", "a@b.io", "--json"]), 0)


if __name__ == "__main__":
    unittest.main()
