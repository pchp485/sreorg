"""Audit logging service.

Every security-relevant event — wake word, verification result, authorization
decision, execution — is recorded as a structured audit event. Audit events
are emitted to the structured logger (shippable to CloudWatch/ELK) and kept in
a bounded in-memory ring buffer that the dashboard can read for recent
activity. Unauthorized attempts are logged at WARNING so they can drive alerts.
"""

from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("parentai.audit")


class AuditLog:
    def __init__(self, max_events: int = 1000) -> None:
        self._events: deque[dict[str, Any]] = deque(maxlen=max_events)

    def record(
        self,
        event: str,
        *,
        user_id: str | None = None,
        role: str | None = None,
        outcome: str,
        detail: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "user_id": user_id,
            "role": role,
            "outcome": outcome,
            "session_id": session_id,
            "detail": detail or {},
        }
        self._events.append(entry)
        level = (
            logging.WARNING
            if outcome in ("denied", "unauthorized", "rejected")
            else logging.INFO
        )
        logger.log(level, "audit", extra={"audit": entry})

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        events = list(self._events)
        return events[-limit:][::-1]
