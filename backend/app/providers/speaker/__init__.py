"""Speaker verification providers."""

from __future__ import annotations

from app.config import Settings
from app.providers.base import SpeakerVerificationProvider


def build_speaker_provider(settings: Settings) -> SpeakerVerificationProvider:
    provider = settings.speaker_provider
    if provider == "azure":
        from .azure import AzureSpeakerProvider

        return AzureSpeakerProvider(
            key=settings.azure_speech_key, region=settings.azure_speech_region
        )
    if provider == "elevenlabs":
        from .elevenlabs import ElevenLabsSpeakerProvider

        return ElevenLabsSpeakerProvider(api_key=settings.elevenlabs_api_key)
    if provider == "mock":
        from .mock import MockSpeakerProvider

        return MockSpeakerProvider()

    from .local_ml import LocalMLSpeakerProvider

    return LocalMLSpeakerProvider(profile_dir=settings.voice_profile_dir)
