"""Application configuration via Pydantic settings.

All configuration is environment-driven (12-factor). Sensible, *safe*
defaults are chosen so the system boots and runs fully locally with mock /
local providers when no cloud credentials are supplied. Enabling a cloud
provider is a matter of setting the relevant environment variables.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PARENTAI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- General -------------------------------------------------------
    app_name: str = "ParentAI"
    environment: Literal["local", "dev", "staging", "prod"] = "local"
    debug: bool = False
    log_level: str = "INFO"
    json_logs: bool = True

    # --- Security ------------------------------------------------------
    jwt_secret: str = "change-me-in-production-with-a-32plus-byte-secret"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60
    # Minimum confidence to accept a speaker match [0, 1].
    speaker_confidence_threshold: float = 0.75
    rate_limit_per_minute: int = 60

    # --- Provider selection -------------------------------------------
    wakeword_provider: Literal["porcupine", "keyword"] = "keyword"
    stt_provider: Literal["whisper", "mock"] = "mock"
    # Default to the mock provider so a zero-config local run works end-to-end
    # (text clients supply the verified speaker). Switch to local_ml/azure/
    # elevenlabs — which require voice enrollment or cloud keys — for real use.
    speaker_provider: Literal["azure", "elevenlabs", "local_ml", "mock"] = "mock"
    llm_provider: Literal["openai", "mock"] = "mock"

    # --- Wake word -----------------------------------------------------
    porcupine_access_key: str | None = None
    wake_words: list[str] = Field(default_factory=lambda: ["hey parentai", "hey jarvis"])

    # --- STT (Whisper) -------------------------------------------------
    whisper_model: str = "base"
    whisper_device: str = "cpu"

    # --- Speaker verification -----------------------------------------
    azure_speech_key: str | None = None
    azure_speech_region: str | None = None
    elevenlabs_api_key: str | None = None
    voice_profile_dir: str = "./data/voice_profiles"

    # --- LLM (OpenAI Responses API) -----------------------------------
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    llm_temperature: float = 0.3

    # --- Smart home ----------------------------------------------------
    home_assistant_url: str | None = None
    home_assistant_token: str | None = None
    mqtt_host: str | None = None
    mqtt_port: int = 1883
    hue_bridge_ip: str | None = None
    hue_username: str | None = None
    aws_iot_endpoint: str | None = None
    device_provider_order: list[str] = Field(
        default_factory=lambda: ["home_assistant", "hue", "kasa", "mqtt", "mock"]
    )

    # --- Data stores ---------------------------------------------------
    database_url: str = "sqlite+aiosqlite:///./data/parentai.db"
    redis_url: str = "redis://localhost:6379/0"
    session_ttl_seconds: int = 1800

    # --- Observability -------------------------------------------------
    otel_exporter_endpoint: str | None = None
    metrics_enabled: bool = True

    @field_validator("wake_words", mode="before")
    @classmethod
    def _normalise_wake_words(cls, v: object) -> object:
        if isinstance(v, str):
            return [w.strip().lower() for w in v.split(",") if w.strip()]
        if isinstance(v, list):
            return [str(w).strip().lower() for w in v]
        return v


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor used across the app and as a FastAPI dependency."""
    return Settings()
