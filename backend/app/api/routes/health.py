"""Health and readiness endpoints for orchestrators and load balancers."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.container import Container
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"status": "alive"}


@router.get("/health/ready")
async def ready(container: Container = Depends(get_container)) -> dict[str, str]:
    """Readiness: dependencies constructed and pipeline assembled."""
    return {"status": "ready" if container.pipeline else "not_ready"}


@router.get("/health", response_model=HealthResponse)
async def health(container: Container = Depends(get_container)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=container.settings.environment,
        providers={
            "wakeword": container.wakeword.name,
            "stt": container.stt.name,
            "speaker": container.speaker.name,
            "llm": container.llm.name,
            "devices": container.devices.name,
        },
    )
