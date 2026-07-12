"""FastAPI application factory (the api-gateway surface).

Assembles the container, wires routes, sets up middleware (CORS, rate limiting),
observability (structured logging, Prometheus metrics, optional tracing), and
exposes OpenAPI docs. This is the single deployable that fronts all backend
services; each service module (auth, voice, devices, ...) is independently
extractable into its own process because it depends only on the container's
abstractions.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from app.api.deps import RateLimiter
from app.api.routes import audit, devices, health, users, voice, ws
from app.config import get_settings
from app.container import build_container
from app.domain.exceptions import (
    PermissionDeniedError,
    ProviderError,
    UnauthorizedSpeakerError,
)
from app.logging_config import configure_logging
from app.telemetry import metrics_available, setup_tracing

logger = logging.getLogger(__name__)

DESCRIPTION = """
**ParentAI** — a secure voice assistant that only executes commands from
authorized parents. Every request passes a wake-word + speaker-verification
gate before any protected action runs.
"""


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(level=settings.log_level, json_logs=settings.json_logs)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=DESCRIPTION,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.state.container = build_container(settings)
    app.state.rate_limiter = RateLimiter(settings.rate_limit_per_minute)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.environment == "local" else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Domain-exception → HTTP translation.
    @app.exception_handler(UnauthorizedSpeakerError)
    async def _unauthorized(_req, exc: UnauthorizedSpeakerError):
        return JSONResponse(status_code=403, content={"detail": str(exc)})

    @app.exception_handler(PermissionDeniedError)
    async def _forbidden(_req, exc: PermissionDeniedError):
        return JSONResponse(
            status_code=403,
            content={"detail": str(exc), "spoken_response": exc.spoken_response},
        )

    @app.exception_handler(ProviderError)
    async def _provider(_req, exc: ProviderError):
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    for module in (health, voice, users, devices, audit):
        app.include_router(module.router)
    app.include_router(ws.router)

    if settings.metrics_enabled and metrics_available():
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

        @app.get("/metrics", include_in_schema=False)
        async def metrics() -> PlainTextResponse:
            return PlainTextResponse(
                generate_latest(), media_type=CONTENT_TYPE_LATEST
            )

    setup_tracing(app, settings.otel_exporter_endpoint)

    logger.info(
        "ParentAI started (env=%s, speaker=%s, llm=%s, wakeword=%s)",
        settings.environment,
        settings.speaker_provider,
        settings.llm_provider,
        settings.wakeword_provider,
    )
    return app


app = create_app()
