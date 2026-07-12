"""FastAPI dependencies: container access, auth, and rate limiting."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Depends, Header, HTTPException, Request, status

from app.container import Container
from app.domain.models import Role


def get_container(request: Request) -> Container:
    return request.app.state.container


class TokenClaims:
    def __init__(self, sub: str, role: Role) -> None:
        self.sub = sub
        self.role = role


async def require_auth(
    authorization: str | None = Header(default=None),
    container: Container = Depends(get_container),
) -> TokenClaims:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token."
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = container.auth.decode_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token."
        ) from exc
    return TokenClaims(sub=payload["sub"], role=Role(payload["role"]))


def require_admin(claims: TokenClaims = Depends(require_auth)) -> TokenClaims:
    if claims.role not in (Role.ADMIN, Role.PARENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or parent role required.",
        )
    return claims


class RateLimiter:
    """Simple in-process sliding-window rate limiter keyed by client IP.

    For multi-instance deployments this is backed by Redis in production; the
    in-process version protects single-instance and dev deployments and keeps
    the dependency graph simple for tests.
    """

    def __init__(self, per_minute: int) -> None:
        self._per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        window = self._hits[key]
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= self._per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded.",
            )
        window.append(now)


def rate_limit(
    request: Request, container: Container = Depends(get_container)
) -> None:
    limiter: RateLimiter = request.app.state.rate_limiter
    client = request.client.host if request.client else "unknown"
    limiter.check(client)
