"""SQLite persistence.

SQLite because the cheapest database is the one with no monthly bill and no
credentials to leak. It is committed nowhere: `data/*.db` is gitignored, and the
daily workflow rebuilds state from the gateway when it needs to.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import asdict, fields
from pathlib import Path
from typing import Any, Iterator

from .config import DB_PATH
from .models import Lead, LeadStage, Order, OrderStatus, now

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT, org TEXT, source TEXT NOT NULL,
    stage TEXT NOT NULL, consent INTEGER NOT NULL DEFAULT 0,
    consent_evidence TEXT, notes TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    offer_slug TEXT NOT NULL, amount_paise INTEGER NOT NULL,
    email TEXT NOT NULL, status TEXT NOT NULL,
    international INTEGER NOT NULL DEFAULT 0,
    gateway_order_id TEXT, gateway_payment_id TEXT, payment_link TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- One row per calendar month per subscription, so churn is visible rather
-- than inferred.
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL, offer_slug TEXT NOT NULL,
    amount_paise INTEGER NOT NULL, international INTEGER NOT NULL DEFAULT 0,
    started_on TEXT NOT NULL, cancelled_on TEXT,
    created_at TEXT NOT NULL
);

-- Append-only funnel log. Every published article, every visit, every
-- signup. The planner reads this to work out which lever is cheapest.
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL, ref TEXT, value REAL NOT NULL DEFAULT 1,
    meta TEXT, occurred_at TEXT NOT NULL
);

-- Idempotency: a gateway webhook is delivered more than once, by design.
CREATE TABLE IF NOT EXISTS processed_webhooks (
    signature TEXT PRIMARY KEY,
    event_id TEXT, received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, occurred_at);
"""


@contextmanager
def connect(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    path = Path(path or DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def _row_to(cls: type, row: sqlite3.Row) -> Any:
    """Rebuild a dataclass from a row, coercing the columns SQLite flattens."""
    names = {f.name for f in fields(cls)}
    data = {k: row[k] for k in row.keys() if k in names}
    if "consent" in data:
        data["consent"] = bool(data["consent"])
    if "international" in data:
        data["international"] = bool(data["international"])
    if "stage" in data:
        data["stage"] = LeadStage(data["stage"])
    if "status" in data:
        data["status"] = OrderStatus(data["status"])
    return cls(**data)


# --- Leads -----------------------------------------------------------------

def upsert_lead(lead: Lead, conn: sqlite3.Connection | None = None) -> Lead:
    def _run(c: sqlite3.Connection) -> Lead:
        existing = c.execute(
            "SELECT id FROM leads WHERE email = ?", (lead.email.lower(),)
        ).fetchone()
        lead.email = lead.email.lower()
        lead.updated_at = now()
        if existing:
            lead.id = existing["id"]
            c.execute(
                """UPDATE leads SET name=?, org=?, source=?, stage=?, consent=?,
                   consent_evidence=?, notes=?, updated_at=? WHERE id=?""",
                (lead.name, lead.org, lead.source, lead.stage.value, int(lead.consent),
                 lead.consent_evidence, lead.notes, lead.updated_at, lead.id),
            )
        else:
            c.execute(
                """INSERT INTO leads (id,email,name,org,source,stage,consent,
                   consent_evidence,notes,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (lead.id, lead.email, lead.name, lead.org, lead.source,
                 lead.stage.value, int(lead.consent), lead.consent_evidence,
                 lead.notes, lead.created_at, lead.updated_at),
            )
        return lead

    if conn is not None:
        return _run(conn)
    with connect() as c:
        return _run(c)


def list_leads(stage: LeadStage | None = None, consented: bool | None = None) -> list[Lead]:
    sql, params = "SELECT * FROM leads", []
    clauses = []
    if stage:
        clauses.append("stage = ?")
        params.append(stage.value)
    if consented is not None:
        clauses.append("consent = ?")
        params.append(int(consented))
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC"
    with connect() as c:
        return [_row_to(Lead, r) for r in c.execute(sql, params)]


# --- Orders ----------------------------------------------------------------

def save_order(order: Order, conn: sqlite3.Connection | None = None) -> Order:
    def _run(c: sqlite3.Connection) -> Order:
        order.updated_at = now()
        d = asdict(order)
        d["status"] = order.status.value
        d["international"] = int(order.international)
        cols = ",".join(d)
        marks = ",".join("?" * len(d))
        c.execute(f"INSERT OR REPLACE INTO orders ({cols}) VALUES ({marks})", tuple(d.values()))
        return order

    if conn is not None:
        return _run(conn)
    with connect() as c:
        return _run(c)


def get_order(order_id: str) -> Order | None:
    with connect() as c:
        row = c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return _row_to(Order, row) if row else None


def find_order_by_gateway(gateway_order_id: str) -> Order | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM orders WHERE gateway_order_id = ?", (gateway_order_id,)
        ).fetchone()
        return _row_to(Order, row) if row else None


def list_orders(status: OrderStatus | None = None, since: str | None = None) -> list[Order]:
    sql, params = "SELECT * FROM orders", []
    clauses = []
    if status:
        clauses.append("status = ?")
        params.append(status.value)
    if since:
        clauses.append("created_at >= ?")
        params.append(since)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC"
    with connect() as c:
        return [_row_to(Order, r) for r in c.execute(sql, params)]


# --- Subscriptions ---------------------------------------------------------

def active_subscriptions(as_of: str | None = None) -> list[dict]:
    as_of = as_of or now()
    with connect() as c:
        rows = c.execute(
            """SELECT * FROM subscriptions
               WHERE started_on <= ? AND (cancelled_on IS NULL OR cancelled_on > ?)""",
            (as_of, as_of),
        ).fetchall()
        return [dict(r) for r in rows]


# --- Funnel events ---------------------------------------------------------

def record_event(kind: str, ref: str = "", value: float = 1.0, meta: str = "") -> None:
    with connect() as c:
        c.execute(
            "INSERT INTO events (kind,ref,value,meta,occurred_at) VALUES (?,?,?,?,?)",
            (kind, ref, value, meta, now()),
        )


def count_events(kind: str, since: str | None = None) -> float:
    sql, params = "SELECT COALESCE(SUM(value),0) AS n FROM events WHERE kind = ?", [kind]
    if since:
        sql += " AND occurred_at >= ?"
        params.append(since)
    with connect() as c:
        return float(c.execute(sql, params).fetchone()["n"])


# --- Webhook idempotency ---------------------------------------------------

def already_processed(signature: str) -> bool:
    with connect() as c:
        return c.execute(
            "SELECT 1 FROM processed_webhooks WHERE signature = ?", (signature,)
        ).fetchone() is not None


def mark_processed(signature: str, event_id: str = "") -> None:
    with connect() as c:
        c.execute(
            "INSERT OR IGNORE INTO processed_webhooks (signature,event_id,received_at) "
            "VALUES (?,?,?)",
            (signature, event_id, now()),
        )
