"""Device provider registry.

The :class:`DeviceRegistry` aggregates all configured device providers and
routes each command to the first provider that supports the target. This is
the "device-service" from the architecture: a single façade over many smart
-home integrations. The mock provider is always registered last as a
catch-all so local/dev deployments behave predictably.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import Settings
from app.domain.exceptions import ProviderError
from app.domain.models import DeviceCommand
from app.providers.base import DeviceProvider

from .mock import MockDeviceProvider

logger = logging.getLogger(__name__)


class DeviceRegistry(DeviceProvider):
    name = "registry"

    def __init__(self, providers: list[DeviceProvider]) -> None:
        self._providers = providers

    async def supports(self, command: DeviceCommand) -> bool:
        for provider in self._providers:
            if await provider.supports(command):
                return True
        return False

    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        for provider in self._providers:
            if await provider.supports(command):
                logger.info(
                    "Dispatching %s/%s -> %s via %s",
                    command.domain,
                    command.service,
                    command.target,
                    provider.name,
                )
                return await provider.execute(command)
        raise ProviderError(f"No device provider can handle target '{command.target}'.")

    async def list_devices(self) -> list[dict[str, Any]]:
        devices: list[dict[str, Any]] = []
        for provider in self._providers:
            try:
                for dev in await provider.list_devices():
                    devices.append({"provider": provider.name, **dev})
            except Exception as exc:  # noqa: BLE001 - one bad provider shouldn't break listing
                logger.warning("list_devices failed for %s: %s", provider.name, exc)
        return devices


def build_device_registry(settings: Settings) -> DeviceRegistry:
    providers: list[DeviceProvider] = []
    for name in settings.device_provider_order:
        try:
            providers.append(_build_one(name, settings))
        except ProviderError as exc:
            logger.info("Skipping device provider '%s': %s", name, exc)
    # Guarantee a catch-all so the system always has a functioning device layer.
    if not any(p.name == "mock" for p in providers):
        providers.append(MockDeviceProvider())
    return DeviceRegistry(providers)


def _build_one(name: str, settings: Settings) -> DeviceProvider:
    if name == "home_assistant":
        if not (settings.home_assistant_url and settings.home_assistant_token):
            raise ProviderError("Home Assistant not configured.")
        from .home_assistant import HomeAssistantProvider

        return HomeAssistantProvider(
            settings.home_assistant_url, settings.home_assistant_token
        )
    if name == "hue":
        if not (settings.hue_bridge_ip and settings.hue_username):
            raise ProviderError("Hue not configured.")
        from .integrations import HueProvider

        return HueProvider(settings.hue_bridge_ip, settings.hue_username)
    if name == "kasa":
        from .integrations import KasaProvider

        return KasaProvider()
    if name == "mqtt":
        if not settings.mqtt_host:
            raise ProviderError("MQTT not configured.")
        from .integrations import MqttProvider

        return MqttProvider(settings.mqtt_host, settings.mqtt_port)
    if name == "aws_iot":
        if not settings.aws_iot_endpoint:
            raise ProviderError("AWS IoT not configured.")
        from .integrations import AwsIotProvider

        return AwsIotProvider(settings.aws_iot_endpoint)
    if name == "mock":
        return MockDeviceProvider()
    raise ProviderError(f"Unknown device provider '{name}'.")
