"""Authentication, user directory and enrollment service.

Responsibilities:
* Maintain the directory of enrolled users (parents, admin, guests, children).
* Handle voice enrollment (delegates embedding/profile creation to the speaker
  provider and records the returned profile id on the user).
* Issue and validate JWTs for the dashboard/API (OAuth2 password flow style).

The directory is seeded with the two authorized parents (Harish and spouse)
plus example child/guest accounts so the system enforces real rules out of the
box. In production the directory is backed by PostgreSQL (see ``app.db``); the
in-memory implementation here keeps the domain logic testable and lets the app
boot without a database.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.config import Settings
from app.domain.exceptions import ParentAIError
from app.domain.models import Role, User
from app.providers.base import SpeakerVerificationProvider

logger = logging.getLogger(__name__)


def _seed_users() -> dict[str, User]:
    users = [
        User(id="harish", name="Harish", role=Role.PARENT),
        User(id="spouse", name="Spouse", role=Role.PARENT),
        User(id="admin", name="Administrator", role=Role.ADMIN),
        User(id="child_leo", name="Leo", role=Role.CHILD),
        User(id="guest", name="Guest", role=Role.GUEST),
    ]
    return {u.id: u for u in users}


class AuthService:
    def __init__(
        self, settings: Settings, speaker_provider: SpeakerVerificationProvider
    ) -> None:
        self._settings = settings
        self._speaker = speaker_provider
        self._users: dict[str, User] = _seed_users()

    # -- directory ------------------------------------------------------
    def list_users(self) -> list[User]:
        return list(self._users.values())

    def get_user(self, user_id: str) -> User | None:
        return self._users.get(user_id)

    def authorized_candidates(self) -> list[User]:
        """All enabled users that speaker verification should match against."""
        return [u for u in self._users.values() if u.enabled]

    def add_user(self, user: User) -> User:
        self._users[user.id] = user
        return user

    def set_enabled(self, user_id: str, enabled: bool) -> User:
        user = self._require(user_id)
        updated = User(
            id=user.id,
            name=user.name,
            role=user.role,
            voice_profile_ids=user.voice_profile_ids,
            enabled=enabled,
        )
        self._users[user_id] = updated
        return updated

    # -- enrollment -----------------------------------------------------
    async def enroll_voice(self, user_id: str, audio: bytes) -> User:
        user = self._require(user_id)
        profile_id = await self._speaker.enroll(user, audio)
        if profile_id not in user.voice_profile_ids:
            user = User(
                id=user.id,
                name=user.name,
                role=user.role,
                voice_profile_ids=(*user.voice_profile_ids, profile_id),
                enabled=user.enabled,
            )
            self._users[user_id] = user
        logger.info("Enrolled voice profile %s for user %s", profile_id, user_id)
        return user

    # -- JWT ------------------------------------------------------------
    def issue_token(self, user_id: str) -> str:
        user = self._require(user_id)
        now = datetime.now(UTC)
        payload = {
            "sub": user.id,
            "role": user.role.value,
            "iat": int(now.timestamp()),
            "exp": int(
                (now + timedelta(minutes=self._settings.jwt_expires_minutes)).timestamp()
            ),
        }
        return jwt.encode(
            payload, self._settings.jwt_secret, algorithm=self._settings.jwt_algorithm
        )

    def decode_token(self, token: str) -> dict[str, Any]:
        return jwt.decode(
            token,
            self._settings.jwt_secret,
            algorithms=[self._settings.jwt_algorithm],
        )

    def _require(self, user_id: str) -> User:
        user = self._users.get(user_id)
        if user is None:
            raise ParentAIError(f"Unknown user '{user_id}'.")
        return user
