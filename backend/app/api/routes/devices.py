"""Device inventory endpoint (dashboard 'Devices' panel)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container, require_auth
from app.container import Container

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("")
async def list_devices(
    container: Container = Depends(get_container),
    _=Depends(require_auth),
) -> list[dict]:
    return await container.devices.list_devices()
