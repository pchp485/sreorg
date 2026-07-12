"""Conversation session memory.

Stores per-session multi-turn conversation history with a TTL. Uses Redis when
available (production, multi-instance) and transparently falls back to an
in-process store (local dev / tests). The interface is intentionally tiny so
either backend satisfies it.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Protocol

from app.domain.models import ConversationTurn

logger = logging.getLogger(__name__)


class SessionMemory(Protocol):
    async def append(self, session_id: str, turn: ConversationTurn) -> None: ...
    async def history(self, session_id: str) -> list[ConversationTurn]: ...
    async def clear(self, session_id: str) -> None: ...


class InMemorySessionMemory:
    """Process-local session memory with TTL. Good for dev and tests."""

    def __init__(self, ttl_seconds: int = 1800) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, list[ConversationTurn]]] = {}

    def _live(self, session_id: str) -> list[ConversationTurn]:
        entry = self._store.get(session_id)
        if entry is None:
            return []
        expires, turns = entry
        if time.time() > expires:
            self._store.pop(session_id, None)
            return []
        return turns

    async def append(self, session_id: str, turn: ConversationTurn) -> None:
        turns = self._live(session_id)
        turns.append(turn)
        self._store[session_id] = (time.time() + self._ttl, turns)

    async def history(self, session_id: str) -> list[ConversationTurn]:
        return list(self._live(session_id))

    async def clear(self, session_id: str) -> None:
        self._store.pop(session_id, None)


class RedisSessionMemory:
    """Redis-backed session memory for multi-instance deployments."""

    def __init__(self, redis_url: str, ttl_seconds: int = 1800) -> None:
        import redis.asyncio as redis  # noqa: PLC0415 (optional dep)

        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl_seconds

    def _key(self, session_id: str) -> str:
        return f"parentai:session:{session_id}"

    async def append(self, session_id: str, turn: ConversationTurn) -> None:
        key = self._key(session_id)
        await self._redis.rpush(
            key, json.dumps({"role": turn.role, "content": turn.content})
        )
        await self._redis.expire(key, self._ttl)

    async def history(self, session_id: str) -> list[ConversationTurn]:
        raw = await self._redis.lrange(self._key(session_id), 0, -1)
        return [
            ConversationTurn(role=(d := json.loads(r))["role"], content=d["content"])
            for r in raw
        ]

    async def clear(self, session_id: str) -> None:
        await self._redis.delete(self._key(session_id))


def build_session_memory(redis_url: str, ttl_seconds: int) -> SessionMemory:
    try:
        memory = RedisSessionMemory(redis_url, ttl_seconds)
        logger.info("Using Redis session memory.")
        return memory
    except Exception as exc:  # noqa: BLE001 - graceful fallback
        logger.info("Redis unavailable (%s); using in-memory session store.", exc)
        return InMemorySessionMemory(ttl_seconds)
