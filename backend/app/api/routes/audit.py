"""Audit-log and permission-matrix endpoints for the dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container, require_admin
from app.container import Container
from app.domain.models import Role

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/audit")
async def recent_audit(
    limit: int = 100,
    container: Container = Depends(get_container),
    _=Depends(require_admin),
) -> list[dict]:
    return container.audit.recent(limit)


@router.get("/permissions")
async def permission_matrix(
    container: Container = Depends(get_container),
    _=Depends(require_admin),
) -> dict[str, list[str]]:
    """Return the effective role → permitted-categories matrix."""
    return {
        role.value: sorted(
            c.value for c in container.policy.permitted_categories(role)
        )
        for role in Role
    }
