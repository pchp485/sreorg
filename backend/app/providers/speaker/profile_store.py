"""File-based voice-profile store for local speaker verification.

Profiles are stored as JSON documents keyed by profile id. Each profile holds
one or more embedding vectors (multiple enrollment samples improve accuracy).
In production this can be swapped for an S3/DB-backed store without touching
the provider — it only depends on the small interface below.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class VoiceProfile:
    profile_id: str
    user_id: str
    embeddings: list[list[float]] = field(default_factory=list)


class VoiceProfileStore:
    def __init__(self, directory: str) -> None:
        self._dir = Path(directory)
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, profile_id: str) -> Path:
        return self._dir / f"{profile_id}.json"

    def create(self, user_id: str) -> VoiceProfile:
        profile = VoiceProfile(profile_id=str(uuid.uuid4()), user_id=user_id)
        self.save(profile)
        return profile

    def save(self, profile: VoiceProfile) -> None:
        # Atomic write to avoid corrupting a profile mid-enrollment.
        tmp = self._path(profile.profile_id).with_suffix(".tmp")
        tmp.write_text(
            json.dumps(
                {
                    "profile_id": profile.profile_id,
                    "user_id": profile.user_id,
                    "embeddings": profile.embeddings,
                }
            )
        )
        os.replace(tmp, self._path(profile.profile_id))

    def get(self, profile_id: str) -> VoiceProfile | None:
        path = self._path(profile_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return VoiceProfile(
            profile_id=data["profile_id"],
            user_id=data["user_id"],
            embeddings=data.get("embeddings", []),
        )

    def all(self) -> list[VoiceProfile]:
        profiles: list[VoiceProfile] = []
        for path in self._dir.glob("*.json"):
            data = json.loads(path.read_text())
            profiles.append(
                VoiceProfile(
                    profile_id=data["profile_id"],
                    user_id=data["user_id"],
                    embeddings=data.get("embeddings", []),
                )
            )
        return profiles
