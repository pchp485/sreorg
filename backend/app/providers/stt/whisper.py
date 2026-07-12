"""OpenAI Whisper (local) speech-to-text provider.

Runs Whisper locally for privacy-preserving, offline transcription. The model
is loaded lazily and transcription runs in a thread pool so it never blocks
the async event loop.
"""

from __future__ import annotations

import asyncio
import tempfile

from app.domain.exceptions import ProviderError
from app.providers.base import SpeechToTextProvider


class WhisperSTTProvider(SpeechToTextProvider):
    name = "whisper"

    def __init__(self, model_name: str = "base", device: str = "cpu") -> None:
        self._model_name = model_name
        self._device = device
        self._model = None  # lazy-loaded

    def _ensure_model(self):
        if self._model is None:
            try:
                import whisper  # noqa: PLC0415 (optional dependency)
            except ImportError as exc:  # pragma: no cover - optional dep
                raise ProviderError(
                    "openai-whisper is not installed. `pip install openai-whisper`."
                ) from exc
            self._model = whisper.load_model(self._model_name, device=self._device)
        return self._model

    async def transcribe(self, audio: bytes) -> str:
        def _run() -> str:
            model = self._ensure_model()
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                tmp.write(audio)
                tmp.flush()
                result = model.transcribe(tmp.name, fp16=False)
            return str(result.get("text", "")).strip()

        return await asyncio.to_thread(_run)
