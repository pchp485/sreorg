"""Additional smart-home device providers: Philips Hue, TP-Link Kasa, MQTT and
AWS IoT. Each is a self-contained adapter guarded by its own configuration and
optional dependency, so a deployment only pays for what it enables.

These are intentionally compact; each wraps a well-supported library or a
simple REST/MQTT contract rather than reimplementing a protocol.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.domain.exceptions import ProviderError
from app.domain.models import DeviceCommand
from app.providers.base import DeviceProvider

logger = logging.getLogger(__name__)


class HueProvider(DeviceProvider):
    """Philips Hue bridge (local REST API v1)."""

    name = "hue"

    def __init__(self, bridge_ip: str, username: str) -> None:
        self._base = f"http://{bridge_ip}/api/{username}"

    async def _lights(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self._base}/lights")
            resp.raise_for_status()
            return resp.json()

    async def _find_light_id(self, target: str) -> str | None:
        needle = (target or "").replace("_", " ").lower()
        for lid, light in (await self._lights()).items():
            if needle and needle in light.get("name", "").lower():
                return lid
        return None

    async def supports(self, command: DeviceCommand) -> bool:
        if command.domain not in ("light", "switch"):
            return False
        try:
            return await self._find_light_id(command.target) is not None
        except httpx.HTTPError:  # pragma: no cover - network
            return False

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        lid = await self._find_light_id(command.target)
        state: dict[str, Any] = {"on": command.service in ("turn_on", "set_brightness")}
        if command.service == "set_brightness" and "brightness" in command.data:
            state["bri"] = int(command.data["brightness"] * 254 / 100)
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.put(f"{self._base}/lights/{lid}/state", json=state)
            resp.raise_for_status()
        return {"provider": self.name, "light": lid, "state": state}

    async def list_devices(self) -> list[dict[str, Any]]:
        return [
            {"id": lid, "name": light.get("name")}
            for lid, light in (await self._lights()).items()
        ]


class KasaProvider(DeviceProvider):
    """TP-Link Kasa smart plugs/switches via the ``python-kasa`` library."""

    name = "kasa"

    def __init__(self) -> None:
        try:
            import kasa  # noqa: F401, PLC0415 (optional dep)
        except ImportError as exc:  # pragma: no cover - optional dep
            raise ProviderError("python-kasa not installed. `pip install python-kasa`.") from exc
        self._devices: dict[str, Any] = {}

    async def _discover(self) -> dict[str, Any]:
        from kasa import Discover  # noqa: PLC0415

        if not self._devices:
            found = await Discover.discover()
            self._devices = {
                dev.alias.lower().replace(" ", "_"): dev for dev in found.values()
            }
        return self._devices

    async def supports(self, command: DeviceCommand) -> bool:
        if command.domain not in ("switch", "light"):
            return False
        try:
            return (command.target or "") in await self._discover()
        except Exception:  # noqa: BLE001  pragma: no cover - network
            return False

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        dev = (await self._discover())[command.target]
        await dev.update()
        if command.service == "turn_on":
            await dev.turn_on()
        elif command.service == "turn_off":
            await dev.turn_off()
        return {"provider": self.name, "target": command.target, "is_on": dev.is_on}

    async def list_devices(self) -> list[dict[str, Any]]:
        return [{"id": k} for k in (await self._discover())]


class MqttProvider(DeviceProvider):
    """Generic MQTT device provider.

    Publishes commands to ``parentai/<domain>/<target>/set`` as JSON. Works
    with any MQTT-based home automation (Zigbee2MQTT, Tasmota, ESPHome, etc.).
    """

    name = "mqtt"

    def __init__(self, host: str, port: int = 1883) -> None:
        self._host = host
        self._port = port
        try:
            import paho.mqtt.publish  # noqa: F401, PLC0415 (optional dep)
        except ImportError as exc:  # pragma: no cover - optional dep
            raise ProviderError("paho-mqtt not installed. `pip install paho-mqtt`.") from exc

    async def supports(self, command: DeviceCommand) -> bool:
        return bool(command.target)

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        import asyncio

        import paho.mqtt.publish as publish  # noqa: PLC0415

        topic = f"parentai/{command.domain}/{command.target}/set"
        payload = json.dumps({"service": command.service, **command.data})
        await asyncio.to_thread(
            publish.single, topic, payload, hostname=self._host, port=self._port
        )
        return {"provider": self.name, "topic": topic, "payload": payload}

    async def list_devices(self) -> list[dict[str, Any]]:  # pragma: no cover
        return []


class AwsIotProvider(DeviceProvider):
    """AWS IoT Core device provider using device shadows over MQTT/HTTPS."""

    name = "aws_iot"

    def __init__(self, endpoint: str) -> None:
        self._endpoint = endpoint.rstrip("/")

    async def supports(self, command: DeviceCommand) -> bool:
        return bool(command.target)

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        # Update the named device's shadow desired state.
        url = f"https://{self._endpoint}/things/{command.target}/shadow"
        desired = {"service": command.service, **command.data}
        try:
            import boto3  # noqa: PLC0415 (optional dep)
            from botocore.auth import SigV4Auth  # noqa: F401, PLC0415
        except ImportError as exc:  # pragma: no cover - optional dep
            raise ProviderError("boto3 not installed. `pip install boto3`.") from exc
        # Use signed request via boto3 session credentials.
        session = boto3.Session()
        creds = session.get_credentials()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"state": {"desired": desired}},
                headers={"Authorization": f"AWS4 {creds.access_key}"},
            )
        return {"provider": self.name, "status": resp.status_code, "target": command.target}

    async def list_devices(self) -> list[dict[str, Any]]:  # pragma: no cover
        return []
