"""LLM / conversation providers."""

from __future__ import annotations

from app.config import Settings
from app.providers.base import LLMProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "openai":
        from .openai_responses import OpenAIResponsesProvider

        return OpenAIResponsesProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            temperature=settings.llm_temperature,
        )
    from .mock import MockLLMProvider

    return MockLLMProvider()
