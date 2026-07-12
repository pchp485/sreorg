"""In-memory mock device provider.

Acts as a virtual smart home so commands can be executed and asserted in tests
and local dev. It records state transitions and always "supports" any command,
so it is registered *last* in the provider order as a catch-all.
"""

from __future__ import annotations

from typing import Any

from app.domain.models import DeviceCommand
from app.providers.base import DeviceProvider


class MockDeviceProvider(DeviceProvider):
    name = "mock"

    def __init__(self) -> None:
        self.state: dict[str, dict[str, Any]] = {
            "downstairs_lights": {"domain": "light", "on": True},
            "front_door": {"domain": "lock", "locked": False},
            "garage": {"domain": "cover", "open": False},
            "ac": {"domain": "climate", "temperature": 74},
        }
        self.executed: list[DeviceCommand] = []

    async def supports(self, command: DeviceCommand) -> bool:
        return True

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        self.executed.append(command)
        device = self.state.setdefault(
            command.target, {"domain": command.domain}
        )
        if command.service == "turn_off":
            device["on"] = False
        elif command.service == "turn_on":
            device["on"] = True
        elif command.service == "lock":
            device["locked"] = True
        elif command.service == "unlock":
            device["locked"] = False
        elif command.service in ("open",):
            device["open"] = True
        elif command.service in ("close",):
            device["open"] = False
        elif command.service == "set_temperature":
            device["temperature"] = command.data.get("temperature")
        elif command.service == "set_brightness":
            device["brightness"] = command.data.get("brightness")
        return {"provider": self.name, "target": command.target, "state": device}

    async def list_devices(self) -> list[dict[str, Any]]:
        return [{"id": k, **v} for k, v in self.state.items()]
