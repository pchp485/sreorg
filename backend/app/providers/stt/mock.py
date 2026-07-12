"""Deterministic STT provider for local dev and tests.

If the incoming "audio" is actually UTF-8 text (as chat/test clients send),
it is returned verbatim. Otherwise a fixed transcript is returned so the rest
of the pipeline can be exercised without a real model.
"""

from __future__ import annotations

from app.providers.base import SpeechToTextProvider
from app.providers.textmode import decode as decode_textmode


class MockSTTProvider(SpeechToTextProvider):
    name = "mock"

    async def transcribe(self, audio: bytes) -> str:
        envelope = decode_textmode(audio)
        if envelope is not None:
            return str(envelope.get("text", "")).strip()
        try:
            text = audio.decode("utf-8")
        except (UnicodeDecodeError, AttributeError):
            return "hey parentai turn off the lights"
        return text.strip()
