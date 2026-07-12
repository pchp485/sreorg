"""Home Assistant local API device provider.

Talks to a local Home Assistant instance over its REST API, keeping smart-home
control on the local network (no cloud round-trip). Entities are matched by
fuzzy name/id so spoken targets like "downstairs lights" resolve to
``light.downstairs``.

Requires ``PARENTAI_HOME_ASSISTANT_URL`` and ``PARENTAI_HOME_ASSISTANT_TOKEN``.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.domain.models import DeviceCommand
from app.providers.base import DeviceProvider

logger = logging.getLogger(__name__)

# Map our normalized domains/services to HA services.
_SERVICE_MAP = {
    ("light", "turn_off"): ("light", "turn_off"),
    ("light", "turn_on"): ("light", "turn_on"),
    ("light", "set_brightness"): ("light", "turn_on"),
    ("switch", "turn_off"): ("switch", "turn_off"),
    ("switch", "turn_on"): ("switch", "turn_on"),
    ("lock", "lock"): ("lock", "lock"),
    ("lock", "unlock"): ("lock", "unlock"),
    ("cover", "open"): ("cover", "open_cover"),
    ("cover", "close"): ("cover", "close_cover"),
    ("climate", "set_temperature"): ("climate", "set_temperature"),
}


class HomeAssistantProvider(DeviceProvider):
    name = "home_assistant"

    def __init__(self, url: str, token: str) -> None:
        self._base = url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._entities_cache: list[dict[str, Any]] | None = None

    async def _states(self) -> list[dict[str, Any]]:
        if self._entities_cache is None:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base}/api/states", headers=self._headers
                )
                resp.raise_for_status()
                self._entities_cache = resp.json()
        return self._entities_cache

    async def _resolve_entity(self, target: str, domain: str) -> str | None:
        needle = (target or "").replace("_", " ").lower()
        for entity in await self._states():
            eid = entity["entity_id"]
            if not eid.startswith(f"{domain}."):
                continue
            friendly = entity.get("attributes", {}).get("friendly_name", "").lower()
            if needle and (needle in friendly or needle in eid.replace("_", " ")):
                return eid
        return None

    async def supports(self, command: DeviceCommand) -> bool:
        if (command.domain, command.service) not in _SERVICE_MAP:
            return False
        try:
            return await self._resolve_entity(command.target, command.domain) is not None
        except httpx.HTTPError as exc:  # pragma: no cover - network
            logger.warning("Home Assistant unreachable: %s", exc)
            return False

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        ha_domain, ha_service = _SERVICE_MAP[(command.domain, command.service)]
        entity_id = await self._resolve_entity(command.target, command.domain)
        payload: dict[str, Any] = {"entity_id": entity_id}
        payload.update(command.data)
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self._base}/api/services/{ha_domain}/{ha_service}",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
        return {"provider": self.name, "entity_id": entity_id, "service": ha_service}

    async def list_devices(self) -> list[dict[str, Any]]:
        return [
            {"id": e["entity_id"], "state": e.get("state")}
            for e in await self._states()
        ]
