"""ElevenLabs speaker-verification provider.

ElevenLabs exposes voice-similarity capabilities that we use here for speaker
verification: enrollment registers a voice, and verification compares a probe
sample's embedding against enrolled voices, accepting the best match above the
configured threshold.

Requires ``PARENTAI_ELEVENLABS_API_KEY``. Network/SDK errors degrade to a hard
reject (fail-closed) so an outage can never authorize an unknown speaker.
"""

from __future__ import annotations

import logging

import httpx

from app.domain.exceptions import EnrollmentError, ProviderError
from app.domain.models import User, VerificationResult
from app.providers.base import SpeakerVerificationProvider

logger = logging.getLogger(__name__)

_BASE = "https://api.elevenlabs.io/v1"


class ElevenLabsSpeakerProvider(SpeakerVerificationProvider):
    name = "elevenlabs"

    def __init__(self, api_key: str | None) -> None:
        if not api_key:
            raise ProviderError(
                "ElevenLabs speaker provider requires PARENTAI_ELEVENLABS_API_KEY."
            )
        self._headers = {"xi-api-key": api_key}

    async def enroll(self, user: User, audio: bytes) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE}/voices/add",
                headers=self._headers,
                data={"name": f"parentai-{user.id}"},
                files={"files": (f"{user.id}.wav", audio, "audio/wav")},
            )
        if resp.status_code >= 300:
            raise EnrollmentError(f"ElevenLabs enroll failed: {resp.text}")
        return resp.json()["voice_id"]

    async def verify(
        self, audio: bytes, candidates: list[User], *, threshold: float
    ) -> VerificationResult:
        # Fail-closed: any error results in rejection, never acceptance.
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{_BASE}/voice-verification",
                    headers=self._headers,
                    files={"audio": ("probe.wav", audio, "audio/wav")},
                    data={
                        "voice_ids": ",".join(
                            pid for u in candidates for pid in u.voice_profile_ids
                        )
                    },
                )
            resp.raise_for_status()
            body = resp.json()
        except Exception as exc:  # noqa: BLE001 - fail-closed by design
            logger.error("ElevenLabs verification error (rejecting): %s", exc)
            return VerificationResult(False, 0.0, provider=self.name)

        matched_voice = body.get("voice_id")
        score = float(body.get("similarity", body.get("score", 0.0)))
        user = next(
            (u for u in candidates if matched_voice in u.voice_profile_ids), None
        )
        accepted = user is not None and user.enabled and score >= threshold
        return VerificationResult(
            accepted=accepted,
            confidence=score,
            user=user if accepted else None,
            provider=self.name,
            raw=body,
        )
