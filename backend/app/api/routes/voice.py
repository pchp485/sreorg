"""Voice command endpoints (the primary product surface).

Two entry points:
* ``POST /api/voice/command`` — text-based (chat UI, tests, automations).
* ``POST /api/voice/audio``   — raw audio upload (real devices/clients).

Both flow through the exact same :class:`SecureVoicePipeline`, guaranteeing the
wake-word + speaker-verification security gate applies identically regardless
of input modality.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_container, rate_limit
from app.container import Container
from app.providers.textmode import encode as encode_textmode
from app.schemas import CommandResponse, TextCommandRequest
from app.telemetry import AUTH_FAILURES, LATENCY, REQUESTS

router = APIRouter(prefix="/api/voice", tags=["voice"])


def _record_metrics(result, elapsed: float) -> None:
    if REQUESTS is not None:
        outcome = (
            "executed"
            if result.executed
            else (result.denial_reason or "no_action")
        )
        REQUESTS.labels(outcome=outcome).inc()
        LATENCY.observe(elapsed)
        if not result.authorized or (result.denial_reason and not result.executed):
            if AUTH_FAILURES is not None and result.denial_reason:
                AUTH_FAILURES.labels(reason=result.denial_reason).inc()


@router.post("/command", response_model=CommandResponse)
async def text_command(
    req: TextCommandRequest,
    container: Container = Depends(get_container),
    _: None = Depends(rate_limit),
) -> CommandResponse:
    """Process a text command. For deployments using the mock speaker provider,
    ``speaker``/``confidence`` simulate the verified identity."""
    audio = encode_textmode(
        req.text, speaker=req.speaker, confidence=req.confidence
    )
    start = time.perf_counter()
    result = await container.pipeline.process(audio, session_id=req.session_id)
    _record_metrics(result, time.perf_counter() - start)
    return CommandResponse.from_result(result)


@router.post("/audio", response_model=CommandResponse)
async def audio_command(
    audio: UploadFile = File(...),
    session_id: str = Form("default"),
    container: Container = Depends(get_container),
    _: None = Depends(rate_limit),
) -> CommandResponse:
    """Process a raw audio command through the full pipeline."""
    data = await audio.read()
    start = time.perf_counter()
    result = await container.pipeline.process(data, session_id=session_id)
    _record_metrics(result, time.perf_counter() - start)
    return CommandResponse.from_result(result)
