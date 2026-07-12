"""Dependency-injection container.

Constructs and holds the singletons for the application: the configured
providers, the services, and the assembled pipeline. Building everything in one
place (composition root) keeps the rest of the code free of construction logic
and makes it trivial to substitute providers in tests.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings, get_settings
from app.domain.permissions import PermissionPolicy
from app.providers.base import (
    DeviceProvider,
    LLMProvider,
    SpeakerVerificationProvider,
    SpeechToTextProvider,
    WakeWordProvider,
)
from app.providers.devices import build_device_registry
from app.providers.llm import build_llm_provider
from app.providers.speaker import build_speaker_provider
from app.providers.stt import build_stt_provider
from app.providers.wakeword import build_wakeword_provider
from app.services.audit import AuditLog
from app.services.auth_service import AuthService
from app.services.pipeline import SecureVoicePipeline
from app.services.session_memory import build_session_memory


@dataclass
class Container:
    settings: Settings
    wakeword: WakeWordProvider
    stt: SpeechToTextProvider
    speaker: SpeakerVerificationProvider
    llm: LLMProvider
    devices: DeviceProvider
    auth: AuthService
    policy: PermissionPolicy
    audit: AuditLog
    pipeline: SecureVoicePipeline


def build_container(settings: Settings | None = None) -> Container:
    settings = settings or get_settings()

    wakeword = build_wakeword_provider(settings)
    stt = build_stt_provider(settings)
    speaker = build_speaker_provider(settings)
    llm = build_llm_provider(settings)
    devices = build_device_registry(settings)

    policy = PermissionPolicy()
    audit = AuditLog()
    memory = build_session_memory(settings.redis_url, settings.session_ttl_seconds)
    auth = AuthService(settings, speaker)

    pipeline = SecureVoicePipeline(
        settings=settings,
        wakeword=wakeword,
        stt=stt,
        speaker=speaker,
        llm=llm,
        devices=devices,
        auth=auth,
        policy=policy,
        memory=memory,
        audit=audit,
    )

    return Container(
        settings=settings,
        wakeword=wakeword,
        stt=stt,
        speaker=speaker,
        llm=llm,
        devices=devices,
        auth=auth,
        policy=policy,
        audit=audit,
        pipeline=pipeline,
    )
