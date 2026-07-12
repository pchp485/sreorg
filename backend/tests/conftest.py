"""Shared test fixtures.

Builds a container wired entirely with local/mock providers so the security
pipeline can be exercised deterministically and offline.
"""

from __future__ import annotations

import pytest

from app.config import Settings
from app.container import build_container


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        environment="local",
        wakeword_provider="keyword",
        stt_provider="mock",
        speaker_provider="mock",
        llm_provider="mock",
        device_provider_order=["mock"],
        voice_profile_dir=str(tmp_path / "voice_profiles"),
        redis_url="redis://127.0.0.1:0/0",  # unreachable -> in-memory fallback
        speaker_confidence_threshold=0.75,
    )


@pytest.fixture
def container(settings: Settings):
    return build_container(settings)


@pytest.fixture
def pipeline(container):
    return container.pipeline
