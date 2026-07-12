"""Offline mock LLM provider.

Uses the shared rule-based intent extractor for classification and generates
simple, deterministic conversational responses. Lets the full pipeline run and
be tested without an OpenAI key.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.domain.models import ConversationTurn, Intent
from app.providers.base import LLMProvider

from .intent_rules import extract_intent


class MockLLMProvider(LLMProvider):
    name = "mock"

    async def extract_intent(self, utterance: str) -> Intent:
        return extract_intent(utterance)

    async def respond(
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> str:
        last = next(
            (t.content for t in reversed(history) if t.role == "user"), ""
        )
        return f"(offline) You said: {last}"

    async def stream(  # type: ignore[override]
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> AsyncIterator[str]:
        text = await self.respond(history, system_prompt=system_prompt)
        for word in text.split():
            yield word + " "
