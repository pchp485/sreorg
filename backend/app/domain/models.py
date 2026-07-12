"""Core domain models for ParentAI.

These are framework-agnostic value objects and enums that express the
business rules of the system. They intentionally have no dependency on
FastAPI, SQLAlchemy, or any provider SDK so that the domain can be unit
tested in isolation and reused across services.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


class Role(str, enum.Enum):
    """Authorization roles. Order does not imply privilege ranking; the
    permission policy (see :mod:`app.domain.permissions`) is the source of
    truth for what each role may do."""

    ADMIN = "admin"
    PARENT = "parent"
    GUEST = "guest"
    CHILD = "child"
    # Sentinel role for a speaker that could not be verified.
    UNKNOWN = "unknown"


class ActionCategory(str, enum.Enum):
    """Coarse-grained categories used by the permission engine. Every intent
    the assistant can act on maps to exactly one category."""

    HOME_AUTOMATION = "home_automation"
    SECURITY_ACTION = "security_action"  # locks, garage, alarm
    PURCHASE = "purchase"
    EDUCATIONAL_QUERY = "educational_query"
    GENERAL_QUERY = "general_query"
    SYSTEM_ADMIN = "system_admin"  # enroll users, change permissions


class PipelineStage(str, enum.Enum):
    """Stages of the secure voice pipeline, used for audit + telemetry."""

    WAKEWORD = "wakeword"
    TRANSCRIPTION = "transcription"
    SPEAKER_VERIFICATION = "speaker_verification"
    AUTHORIZATION = "authorization"
    INTENT = "intent"
    EXECUTION = "execution"


@dataclass(frozen=True)
class User:
    """An enrolled user with a role and one or more stored voice profiles."""

    id: str
    name: str
    role: Role
    voice_profile_ids: tuple[str, ...] = field(default_factory=tuple)
    enabled: bool = True


@dataclass(frozen=True)
class VerificationResult:
    """Outcome of speaker verification.

    ``user`` is populated only when a match is accepted. ``confidence`` is a
    normalised score in [0, 1]. ``accepted`` reflects the provider decision
    after applying the configured threshold.
    """

    accepted: bool
    confidence: float
    user: User | None = None
    provider: str = "unknown"
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def is_authorized_speaker(self) -> bool:
        return self.accepted and self.user is not None and self.user.enabled


@dataclass(frozen=True)
class Intent:
    """Structured intent extracted from an utterance."""

    category: ActionCategory
    action: str  # e.g. "turn_off", "set_temperature", "lock"
    target: str | None = None  # e.g. "downstairs_lights", "front_door"
    parameters: dict[str, Any] = field(default_factory=dict)
    utterance: str = ""
    confidence: float = 1.0


@dataclass(frozen=True)
class DeviceCommand:
    """A concrete command to dispatch to a device provider."""

    domain: str  # "light", "climate", "lock", "cover", "switch"
    service: str  # "turn_off", "set_temperature", "lock", "open"
    target: str
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationTurn:
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class PipelineResult:
    """The end-to-end outcome returned to the caller of the pipeline."""

    authorized: bool
    spoken_response: str
    user: User | None = None
    intent: Intent | None = None
    executed: bool = False
    denial_reason: str | None = None
    confidence: float = 0.0
    transcript: str = ""
    stages: dict[str, Any] = field(default_factory=dict)
