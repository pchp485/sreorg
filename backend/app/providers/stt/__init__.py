"""Speech-to-text providers."""

from __future__ import annotations

from app.config import Settings
from app.providers.base import SpeechToTextProvider


def build_stt_provider(settings: Settings) -> SpeechToTextProvider:
    if settings.stt_provider == "whisper":
        from .whisper import WhisperSTTProvider

        return WhisperSTTProvider(
            model_name=settings.whisper_model, device=settings.whisper_device
        )
    from .mock import MockSTTProvider

    return MockSTTProvider()
