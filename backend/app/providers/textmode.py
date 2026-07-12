"""Text-mode envelope for driving mock providers from text clients.

Real audio bytes carry *both* the spoken words (for STT) and the speaker's
voice identity (for verification). Text/chat clients and tests have no audio,
so we encode both facets in a tiny self-describing envelope that the mock STT
and mock speaker providers understand. Real providers never see this envelope
(text mode is only used with mock providers).
"""

from __future__ import annotations

import json

_MAGIC = b"PARENTAI-TEXT\n"


def encode(text: str, *, speaker: str | None, confidence: float) -> bytes:
    return _MAGIC + json.dumps(
        {"text": text, "speaker": speaker, "confidence": confidence}
    ).encode("utf-8")


def decode(audio: bytes) -> dict | None:
    if not isinstance(audio, (bytes, bytearray)) or not audio.startswith(_MAGIC):
        return None
    try:
        return json.loads(audio[len(_MAGIC) :].decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
