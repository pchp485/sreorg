"""OpenAI Responses API conversation provider.

Implements intent extraction (via structured/JSON output), full multi-turn
responses, and streaming using the OpenAI Responses API. Falls back to the
rule-based extractor if the model returns an unparseable classification, so
intent extraction is always robust.

Requires ``PARENTAI_OPENAI_API_KEY``.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from app.domain.exceptions import ProviderError
from app.domain.models import ActionCategory, ConversationTurn, Intent
from app.providers.base import LLMProvider

from .intent_rules import extract_intent

logger = logging.getLogger(__name__)

_INTENT_SYSTEM = (
    "You are an intent classifier for a home voice assistant. Classify the "
    "user's utterance and respond with ONLY a compact JSON object with keys: "
    "category (one of home_automation, security_action, purchase, "
    "educational_query, general_query), action (short verb like turn_off, "
    "set_temperature, lock, open, purchase, answer), target (device/area or "
    "null), parameters (object, e.g. {\"temperature\": 72})."
)


class OpenAIResponsesProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str | None, model: str, temperature: float) -> None:
        if not api_key:
            raise ProviderError("OpenAI provider requires PARENTAI_OPENAI_API_KEY.")
        try:
            from openai import AsyncOpenAI  # noqa: PLC0415 (optional dep)
        except ImportError as exc:  # pragma: no cover - optional dep
            raise ProviderError("openai is not installed. `pip install openai`.") from exc
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature

    async def extract_intent(self, utterance: str) -> Intent:
        try:
            resp = await self._client.responses.create(
                model=self._model,
                temperature=0,
                input=[
                    {"role": "system", "content": _INTENT_SYSTEM},
                    {"role": "user", "content": utterance},
                ],
            )
            data = json.loads(resp.output_text)
            return Intent(
                category=ActionCategory(data["category"]),
                action=str(data.get("action", "answer")),
                target=data.get("target"),
                parameters=data.get("parameters") or {},
                utterance=utterance,
                confidence=0.95,
            )
        except Exception as exc:  # noqa: BLE001 - robust fallback
            logger.warning("OpenAI intent parse failed (%s); using rules.", exc)
            return extract_intent(utterance)

    def _to_input(
        self, history: list[ConversationTurn], system_prompt: str
    ) -> list[dict[str, str]]:
        msgs = [{"role": "system", "content": system_prompt}]
        msgs.extend({"role": t.role, "content": t.content} for t in history)
        return msgs

    async def respond(
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> str:
        resp = await self._client.responses.create(
            model=self._model,
            temperature=self._temperature,
            input=self._to_input(history, system_prompt),
        )
        return resp.output_text

    async def stream(  # type: ignore[override]
        self, history: list[ConversationTurn], *, system_prompt: str
    ) -> AsyncIterator[str]:
        stream = await self._client.responses.create(
            model=self._model,
            temperature=self._temperature,
            input=self._to_input(history, system_prompt),
            stream=True,
        )
        async for event in stream:
            if getattr(event, "type", "") == "response.output_text.delta":
                yield event.delta
