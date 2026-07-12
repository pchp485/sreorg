"""Pydantic request/response models for the API boundary."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.models import PipelineResult, Role, User


class TextCommandRequest(BaseModel):
    """Text-based command entry point (chat clients, tests, dashboard).

    The ``speaker`` field simulates the verified identity for text clients that
    cannot supply audio. In an audio deployment the speaker is derived from the
    voice sample, never trusted from the client.
    """

    text: str = Field(..., examples=["Hey ParentAI, turn off the downstairs lights"])
    session_id: str = "default"
    speaker: str | None = Field(
        default=None,
        description="Optional simulated verified speaker id (mock provider only).",
    )
    confidence: float = Field(default=0.99, ge=0, le=1)


class CommandResponse(BaseModel):
    authorized: bool
    executed: bool
    spoken_response: str
    transcript: str
    denial_reason: str | None = None
    confidence: float = 0.0
    user_id: str | None = None
    role: str | None = None
    intent: dict | None = None

    @classmethod
    def from_result(cls, result: PipelineResult) -> "CommandResponse":
        return cls(
            authorized=result.authorized,
            executed=result.executed,
            spoken_response=result.spoken_response,
            transcript=result.transcript,
            denial_reason=result.denial_reason,
            confidence=result.confidence,
            user_id=result.user.id if result.user else None,
            role=result.user.role.value if result.user else None,
            intent=(
                {
                    "category": result.intent.category.value,
                    "action": result.intent.action,
                    "target": result.intent.target,
                    "parameters": result.intent.parameters,
                }
                if result.intent
                else None
            ),
        )


class UserOut(BaseModel):
    id: str
    name: str
    role: Role
    enabled: bool
    voice_profiles: int

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            name=user.name,
            role=user.role,
            enabled=user.enabled,
            voice_profiles=len(user.voice_profile_ids),
        )


class EnrollResponse(BaseModel):
    user: UserOut
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DeviceOut(BaseModel):
    provider: str
    id: str
    extra: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    environment: str
    providers: dict[str, str]
