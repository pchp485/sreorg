"""Prometheus metrics and OpenTelemetry tracing.

Metrics are always available (cheap, in-process). Tracing is only wired up when
an OTLP endpoint is configured, so local runs stay lightweight. Both are
optional dependencies; the module degrades gracefully if they are absent.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter, Histogram

    REQUESTS = Counter(
        "parentai_pipeline_requests_total",
        "Total voice pipeline requests.",
        ["outcome"],
    )
    AUTH_FAILURES = Counter(
        "parentai_auth_failures_total",
        "Speaker verification / authorization failures.",
        ["reason"],
    )
    LATENCY = Histogram(
        "parentai_pipeline_latency_seconds",
        "End-to-end pipeline latency.",
    )
    _METRICS_AVAILABLE = True
except Exception:  # noqa: BLE001 - optional dep
    REQUESTS = AUTH_FAILURES = LATENCY = None  # type: ignore[assignment]
    _METRICS_AVAILABLE = False


def metrics_available() -> bool:
    return _METRICS_AVAILABLE


def setup_tracing(app, endpoint: str | None) -> None:
    if not endpoint:
        return
    try:  # pragma: no cover - optional infra
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider = TracerProvider(
            resource=Resource.create({"service.name": "parentai"})
        )
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
        )
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry tracing enabled -> %s", endpoint)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to set up tracing: %s", exc)
