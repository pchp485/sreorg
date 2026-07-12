"""Deterministic speaker-verification provider for tests.

Convention: the "audio" is text of the form ``speaker:<user_id>|<confidence>``
(confidence optional, defaults to 0.99). This lets tests drive the exact
verification outcome without any model or audio fixtures.

Examples::

    b"speaker:harish"          -> verified as harish, confidence 0.99
    b"speaker:child_leo|0.9"   -> verified as child_leo, confidence 0.90
    b"speaker:unknown|0.4"     -> low confidence, rejected by threshold
    b"anything else"           -> no match, rejected
"""

from __future__ import annotations

from app.domain.models import User, VerificationResult
from app.providers.base import SpeakerVerificationProvider
from app.providers.textmode import decode as decode_textmode


class MockSpeakerProvider(SpeakerVerificationProvider):
    name = "mock"

    def __init__(self) -> None:
        self._enrolled: dict[str, int] = {}

    async def enroll(self, user: User, audio: bytes) -> str:
        self._enrolled[user.id] = self._enrolled.get(user.id, 0) + 1
        return f"mock-profile-{user.id}"

    async def verify(
        self, audio: bytes, candidates: list[User], *, threshold: float
    ) -> VerificationResult:
        envelope = decode_textmode(audio)
        if envelope is not None:
            user_id = envelope.get("speaker")
            confidence = float(envelope.get("confidence", 0.99))
            match = next((u for u in candidates if u.id == user_id), None)
            accepted = (
                match is not None and match.enabled and confidence >= threshold
            )
            return VerificationResult(
                accepted=accepted,
                confidence=confidence,
                user=match if accepted else None,
                provider=self.name,
                raw={"threshold": threshold},
            )

        try:
            text = audio.decode("utf-8")
        except (UnicodeDecodeError, AttributeError):
            text = ""

        user_id, confidence = None, 0.0
        if text.startswith("speaker:"):
            payload = text[len("speaker:") :]
            if "|" in payload:
                user_id, conf_str = payload.split("|", 1)
                try:
                    confidence = float(conf_str)
                except ValueError:
                    confidence = 0.99
            else:
                user_id, confidence = payload, 0.99

        match = next((u for u in candidates if u.id == user_id), None)
        accepted = match is not None and match.enabled and confidence >= threshold
        return VerificationResult(
            accepted=accepted,
            confidence=confidence,
            user=match if accepted else None,
            provider=self.name,
            raw={"threshold": threshold},
        )
