"""Picovoice Porcupine wake-word provider.

Real, on-device wake-word detection. Requires ``pvporcupine`` and a Picovoice
access key. Falls back to raising a clear ProviderError if misconfigured so
that the failure is explicit rather than silent.

Note: Porcupine consumes fixed-size PCM frames. In a production audio
pipeline the microphone service feeds frames continuously; here we expose a
buffer-oriented ``detect`` for the request/response API surface.
"""

from __future__ import annotations

import struct

from app.domain.exceptions import ProviderError
from app.providers.base import WakeWordProvider

# Built-in Porcupine keywords that approximate the requested wake words.
# "Hey ParentAI" requires a custom .ppn model trained in the Picovoice
# console; "jarvis" ships as a built-in keyword.
_BUILTIN_KEYWORD_MAP = {"hey jarvis": "jarvis", "jarvis": "jarvis"}


class PorcupineWakeWordProvider(WakeWordProvider):
    name = "porcupine"

    def __init__(self, access_key: str | None, keywords: list[str]) -> None:
        if not access_key:
            raise ProviderError(
                "Porcupine selected but PARENTAI_PORCUPINE_ACCESS_KEY is not set."
            )
        try:
            import pvporcupine  # noqa: PLC0415  (optional dependency)
        except ImportError as exc:  # pragma: no cover - optional dep
            raise ProviderError(
                "pvporcupine is not installed. `pip install pvporcupine`."
            ) from exc

        builtins = sorted(
            {_BUILTIN_KEYWORD_MAP[k] for k in keywords if k in _BUILTIN_KEYWORD_MAP}
        )
        if not builtins:
            builtins = ["jarvis"]
        self._porcupine = pvporcupine.create(
            access_key=access_key, keywords=builtins
        )
        self.frame_length = self._porcupine.frame_length
        self.sample_rate = self._porcupine.sample_rate

    async def detect(self, audio: bytes | None, *, hint: str | None = None) -> bool:
        if not audio:
            return False
        # Slice the PCM buffer into Porcupine frames and scan for a detection.
        frame_bytes = self.frame_length * 2  # 16-bit samples
        for offset in range(0, len(audio) - frame_bytes + 1, frame_bytes):
            frame = struct.unpack_from(
                f"<{self.frame_length}h", audio, offset
            )
            if self._porcupine.process(frame) >= 0:
                return True
        return False
