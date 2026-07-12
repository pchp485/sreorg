"""Wake-word detection providers."""

from __future__ import annotations

from app.config import Settings
from app.providers.base import WakeWordProvider


def build_wakeword_provider(settings: Settings) -> WakeWordProvider:
    if settings.wakeword_provider == "porcupine":
        from .porcupine import PorcupineWakeWordProvider

        return PorcupineWakeWordProvider(
            access_key=settings.porcupine_access_key, keywords=settings.wake_words
        )
    from .keyword import KeywordWakeWordProvider

    return KeywordWakeWordProvider(keywords=settings.wake_words)
