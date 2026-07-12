"""Abstract base classes for all pluggable providers.

Each capability (wake word, STT, speaker verification, LLM, devices) is
defined as a Protocol/ABC so that concrete cloud or local implementations can
be swapped via configuration without touching the pipeline. This is the
open/closed principle in action: add a provider by adding a class, not by
editing the orchestrator.
"""

from __future__ import annotations

import abc
from collections.abc import AsyncIterator
from typing import Any

from app.domain.models import (
    ConversationTurn,
    DeviceCommand,
    Intent,
    User,
    VerificationResult,
)


class WakeWordProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def detect(self, audio: bytes | None, *, hint: str | None = None) -> bool:
        """Return True if a configured wake word is present in the audio.

        ``hint`` allows text-based callers (tests, chat clients) to pass the
        already-transcribed leading text instead of raw audio.
        """


class SpeechToTextProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def transcribe(self, audio: bytes) -> str:
        """Transcribe raw audio bytes to text."""


class SpeakerVerificationProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def enroll(self, user: User, audio: bytes) -> str:
        """Create/append a voice profile for ``user``. Returns a profile id."""

    @abc.abstractmethod
    async def verify(
        self, audio: bytes, candidates: list[User], *, threshold: float
    ) -> VerificationResult:
        """Identify/verify the speaker against enrolled candidates."""


class LLMProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def extract_intent(self, utterance: str) -> Intent:
        """Classify an utterance into a structured intent."""

    @abc.abstractmethod
    async def respond(
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> str:
        """Produce a full assistant response for a multi-turn conversation."""

    @abc.abstractmethod
    def stream(
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> AsyncIterator[str]:
        """Stream the assistant response token/chunk by chunk."""


class DeviceProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def supports(self, command: DeviceCommand) -> bool:
        """Return True if this provider can service the command's target."""

    @abc.abstractmethod
    async def execute(self, command: DeviceCommand) -> dict[str, Any]:
        """Dispatch the command. Returns a provider-specific result dict."""

    @abc.abstractmethod
    async def list_devices(self) -> list[dict[str, Any]]:
        """Return the devices known to this provider."""
