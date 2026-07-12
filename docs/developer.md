# Developer Guide

## Layout

```
backend/app/
  domain/        Pure business rules: models, permissions, exceptions (no I/O)
  providers/     Pluggable adapters (wakeword, stt, speaker, llm, devices)
  services/      Orchestration: pipeline, auth, audit, session memory
  api/           FastAPI routes + dependencies (the api-gateway)
  db/            SQLAlchemy models + async session
  container.py   Composition root (dependency injection)
  config.py      Pydantic settings (all PARENTAI_* env vars)
```

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"        # add extras: openai, whisper, speaker, smarthome, db, redis, observability
pytest -q
ruff check app tests
```

## Adding a new provider (the common task)

Providers are how you extend the system. Example — a new speaker-verification
backend:

1. Implement `SpeakerVerificationProvider` (`app/providers/base.py`) in
   `app/providers/speaker/my_provider.py` with `enroll` and `verify`.
2. Register it in `app/providers/speaker/__init__.py`'s
   `build_speaker_provider`.
3. Add its config to `app/config.py` and select via
   `PARENTAI_SPEAKER_PROVIDER=my_provider`.
4. **Fail closed**: on any error, return `VerificationResult(accepted=False, ...)`.

The pipeline needs no changes — it depends only on the interface.

## The security invariant

All command handling flows through `SecureVoicePipeline.process`. Never add a
code path that executes a device/purchase/security action outside it. If you add
a new action category, add it to `ActionCategory` and to the permission matrix
in `app/domain/permissions.py`, then add tests to `tests/test_permissions.py`.

## Testing conventions

- Text-mode envelope (`app/providers/textmode.py`) lets tests drive both STT and
  speaker verification from one payload — pass `speaker=` and `confidence=`.
- Security behavior lives in `tests/test_pipeline.py`; the pure matrix in
  `tests/test_permissions.py`; the HTTP surface in `tests/test_api.py`.

## Code style

Type hints everywhere; ruff (E,F,I,B,UP,PL) with 90-col lines; docstrings on
modules and public functions. SOLID + clean architecture: domain has no
framework or SDK imports.
