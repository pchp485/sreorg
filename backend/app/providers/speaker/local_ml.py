"""Local ML speaker-verification provider.

Uses speaker *embeddings* and cosine similarity against enrolled profiles.

Embedding backend
-----------------
If `resemblyzer` (a compact, production-grade speaker-embedding model) is
installed it is used for real d-vector embeddings. Otherwise a deterministic
spectral-feature fallback is used so the pipeline still functions offline and
in CI. The fallback is *not* meant for real security — a warning is logged and
the provider reports ``degraded=True`` in the raw result.

The verification decision is: pick the enrolled user with the highest cosine
similarity; accept only if that similarity >= threshold. This gives us a
confidence score and a hard reject for unknown speakers.
"""

from __future__ import annotations

import hashlib
import logging
import math
import struct

from app.domain.exceptions import EnrollmentError
from app.domain.models import User, VerificationResult
from app.providers.base import SpeakerVerificationProvider

from .profile_store import VoiceProfileStore

logger = logging.getLogger(__name__)

_EMBED_DIM = 256


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    # Map cosine from [-1, 1] to [0, 1] to use as a confidence score.
    return (dot / (na * nb) + 1.0) / 2.0


class LocalMLSpeakerProvider(SpeakerVerificationProvider):
    name = "local_ml"

    def __init__(self, profile_dir: str) -> None:
        self._store = VoiceProfileStore(profile_dir)
        self._encoder = self._load_encoder()

    def _load_encoder(self):
        try:
            from resemblyzer import VoiceEncoder  # noqa: PLC0415 (optional dep)

            logger.info("LocalMLSpeakerProvider using resemblyzer VoiceEncoder.")
            return VoiceEncoder()
        except Exception:  # pragma: no cover - optional dep
            logger.warning(
                "resemblyzer unavailable; using deterministic fallback embedding. "
                "This is NOT secure — install resemblyzer for real verification."
            )
            return None

    # -- embedding ------------------------------------------------------
    def _embed(self, audio: bytes) -> list[float]:
        if self._encoder is not None:  # pragma: no cover - needs model
            import numpy as np
            from resemblyzer import preprocess_wav

            samples = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
            wav = preprocess_wav(samples)
            return self._encoder.embed_utterance(wav).tolist()
        return self._fallback_embed(audio)

    @staticmethod
    def _fallback_embed(audio: bytes) -> list[float]:
        """Deterministic pseudo-embedding derived from coarse signal stats and
        a hash. Distinct inputs map to distinct vectors; identical inputs map
        to identical vectors — enough to exercise enrollment/verification."""
        if not audio:
            return [0.0] * _EMBED_DIM
        # Try to interpret as PCM16 for a couple of cheap spectral-ish stats.
        try:
            count = len(audio) // 2
            samples = struct.unpack_from(f"<{count}h", audio, 0) if count else ()
        except struct.error:
            samples = ()
        energy = (sum(s * s for s in samples) / len(samples)) if samples else 0.0
        digest = hashlib.sha256(audio).digest()
        vec: list[float] = []
        for i in range(_EMBED_DIM):
            byte = digest[i % len(digest)]
            vec.append(((byte / 255.0) - 0.5) + math.tanh(energy / 1e8) * 0.01)
        return vec

    # -- enrollment -----------------------------------------------------
    async def enroll(self, user: User, audio: bytes) -> str:
        if not audio:
            raise EnrollmentError("No audio supplied for enrollment.")
        embedding = self._embed(audio)
        # Append to the user's most recent profile, or create a new one.
        existing = [p for p in self._store.all() if p.user_id == user.id]
        profile = existing[-1] if existing else self._store.create(user.id)
        profile.embeddings.append(embedding)
        self._store.save(profile)
        return profile.profile_id

    # -- verification ---------------------------------------------------
    async def verify(
        self, audio: bytes, candidates: list[User], *, threshold: float
    ) -> VerificationResult:
        probe = self._embed(audio)
        profiles = self._store.all()
        by_user = {u.id: u for u in candidates}

        best_user: User | None = None
        best_score = 0.0
        for profile in profiles:
            user = by_user.get(profile.user_id)
            if user is None or not user.enabled:
                continue
            for emb in profile.embeddings:
                score = _cosine(probe, emb)
                if score > best_score:
                    best_score = score
                    best_user = user

        accepted = best_user is not None and best_score >= threshold
        return VerificationResult(
            accepted=accepted,
            confidence=round(best_score, 4),
            user=best_user if accepted else None,
            provider=self.name,
            raw={"degraded": self._encoder is None, "threshold": threshold},
        )
