"""Microsoft Azure Speaker Recognition provider.

Implements text-independent speaker identification against Azure's Speaker
Recognition REST API. Enrollment creates an Azure profile and stores the
returned profile id on the user's voice profile; verification runs
identification across the enrolled candidate profiles.

Requires ``PARENTAI_AZURE_SPEECH_KEY`` and ``PARENTAI_AZURE_SPEECH_REGION``.
"""

from __future__ import annotations

import logging

import httpx

from app.domain.exceptions import EnrollmentError, ProviderError
from app.domain.models import User, VerificationResult
from app.providers.base import SpeakerVerificationProvider

logger = logging.getLogger(__name__)


class AzureSpeakerProvider(SpeakerVerificationProvider):
    name = "azure"

    def __init__(self, key: str | None, region: str | None) -> None:
        if not key or not region:
            raise ProviderError(
                "Azure speaker provider requires PARENTAI_AZURE_SPEECH_KEY and "
                "PARENTAI_AZURE_SPEECH_REGION."
            )
        self._key = key
        self._base = (
            f"https://{region}.api.cognitive.microsoft.com/"
            "speaker-recognition/identification/text-independent/profiles"
        )
        self._api_version = "2021-09-05"

    def _headers(self, content_type: str | None = None) -> dict[str, str]:
        headers = {"Ocp-Apim-Subscription-Key": self._key}
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    async def enroll(self, user: User, audio: bytes) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            create = await client.post(
                self._base,
                params={"api-version": self._api_version},
                headers=self._headers("application/json"),
                json={"locale": "en-us"},
            )
            if create.status_code >= 300:
                raise EnrollmentError(f"Azure profile create failed: {create.text}")
            profile_id = create.json()["profileId"]

            enroll = await client.post(
                f"{self._base}/{profile_id}/enrollments",
                params={"api-version": self._api_version},
                headers=self._headers("audio/wav"),
                content=audio,
            )
            if enroll.status_code >= 300:
                raise EnrollmentError(f"Azure enrollment failed: {enroll.text}")
        return profile_id

    async def verify(
        self, audio: bytes, candidates: list[User], *, threshold: float
    ) -> VerificationResult:
        profile_ids: dict[str, User] = {}
        for user in candidates:
            for pid in user.voice_profile_ids:
                profile_ids[pid] = user
        if not profile_ids:
            return VerificationResult(False, 0.0, provider=self.name)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._base.rsplit('/', 1)[0]}/identifySingleSpeaker",
                params={
                    "api-version": self._api_version,
                    "profileIds": ",".join(profile_ids),
                },
                headers=self._headers("audio/wav"),
                content=audio,
            )
        if resp.status_code >= 300:
            logger.error("Azure identify failed: %s", resp.text)
            return VerificationResult(False, 0.0, provider=self.name)

        body = resp.json()
        identified = body.get("identifiedProfile", {})
        pid = identified.get("profileId")
        score = float(identified.get("score", 0.0))
        user = profile_ids.get(pid) if pid else None
        accepted = user is not None and user.enabled and score >= threshold
        return VerificationResult(
            accepted=accepted,
            confidence=score,
            user=user if accepted else None,
            provider=self.name,
            raw=body,
        )
