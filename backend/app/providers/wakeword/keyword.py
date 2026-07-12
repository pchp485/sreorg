"""Local, dependency-free wake-word provider.

Detects the wake word from the leading transcribed text. This is the default
provider: it lets the whole system run offline and in tests, and it is the
natural fit for text/chat clients where audio has already been transcribed.
"""

from __future__ import annotations

from app.providers.base import WakeWordProvider


class KeywordWakeWordProvider(WakeWordProvider):
    name = "keyword"

    def __init__(self, keywords: list[str]) -> None:
        self._keywords = [k.lower() for k in keywords]

    async def detect(self, audio: bytes | None, *, hint: str | None = None) -> bool:
        text = (hint or "").lower()
        return any(k in text for k in self._keywords)

    def strip_wake_word(self, text: str) -> str:
        """Remove a leading wake word from an utterance, if present."""
        lowered = text.lower()
        for k in self._keywords:
            idx = lowered.find(k)
            if idx != -1:
                return text[idx + len(k) :].lstrip(" ,.!?").strip()
        return text.strip()
