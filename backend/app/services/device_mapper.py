"""Map a structured :class:`Intent` to a concrete :class:`DeviceCommand`.

Isolated from the pipeline so the (fiddly) natural-language-to-device mapping
can be unit tested on its own.
"""

from __future__ import annotations

from app.domain.models import ActionCategory, DeviceCommand, Intent

# Which smart-home domain a spoken target belongs to.
_TARGET_DOMAIN = {
    "front_door": "lock",
    "back_door": "lock",
    "garage": "cover",
    "ac": "climate",
    "thermostat": "climate",
}
_SWITCH_HINTS = ("plug", "switch", "fan", "outlet")


def _infer_domain(intent: Intent) -> str:
    if intent.action in ("lock", "unlock"):
        return "lock"
    if intent.action in ("open", "close"):
        return "cover"
    if intent.action == "set_temperature":
        return "climate"
    target = intent.target or ""
    if target in _TARGET_DOMAIN:
        return _TARGET_DOMAIN[target]
    if any(h in target for h in _SWITCH_HINTS):
        return "switch"
    return "light"


def to_device_command(intent: Intent) -> DeviceCommand:
    if intent.category not in (
        ActionCategory.HOME_AUTOMATION,
        ActionCategory.SECURITY_ACTION,
    ):
        raise ValueError(f"Intent category {intent.category} is not a device action.")
    domain = _infer_domain(intent)
    data: dict[str, object] = {}
    if intent.action == "set_temperature" and "temperature" in intent.parameters:
        data["temperature"] = intent.parameters["temperature"]
    if intent.action == "set_brightness" and "brightness" in intent.parameters:
        data["brightness"] = intent.parameters["brightness"]
    return DeviceCommand(
        domain=domain,
        service=intent.action,
        target=intent.target or "unknown",
        data=data,
    )
