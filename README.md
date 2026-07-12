# 🛡️ ParentAI — Secure Voice Assistant with Speaker Authentication

ParentAI is a production-oriented voice assistant that **only executes commands
from authorized parents**. Every request must pass a two-factor gate — a
**wake word** *and* **speaker verification** — before any protected action
runs. Children, guests, and unknown speakers are constrained by role-based
permissions (and get a polite refusal).

> **The core promise:** only **Harish** and his **spouse** can control the home.
> Everyone else is rejected with *"Sorry, I only respond to authorized parents."*

---

## Why this design

The security-critical path is a small, pure, **fully-tested** core; everything
external (speech, voice ID, LLM, smart-home) is a **pluggable provider** behind
an interface. This keeps the trust boundary tiny and auditable, and lets you
swap Azure ↔ ElevenLabs ↔ a local model — or Home Assistant ↔ Hue ↔ MQTT —
**by configuration, not code**.

The system **runs fully offline out of the box** using local/mock providers, so
you can try the whole flow with zero cloud credentials, then enable cloud
providers one environment variable at a time.

---

## The secure pipeline

```
 audio ─▶ transcribe ─▶ WAKE-WORD gate ─▶ SPEAKER VERIFICATION ─▶ role
       ─▶ intent extraction ─▶ PERMISSION check (child mode) ─▶ execute
       ─▶ spoken response          (every stage is audited)
```

No protected action is *ever* reached until both the wake word is detected and
the speaker is verified. See [`docs/architecture.md`](docs/architecture.md) for
diagrams.

---

## Quick start (60 seconds, no cloud keys)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs> for interactive API docs, then try the pipeline:

```bash
# Parent → executes
curl -s localhost:8000/api/voice/command -H 'content-type: application/json' \
  -d '{"text":"Hey ParentAI, turn off the downstairs lights","speaker":"harish"}'
# => {"authorized":true,"executed":true,"spoken_response":"Turned off downstairs lights.", ...}

# Unknown speaker → rejected
curl -s localhost:8000/api/voice/command -H 'content-type: application/json' \
  -d '{"text":"Hey ParentAI, unlock the front door","speaker":"stranger"}'
# => {"authorized":false,"executed":false,"spoken_response":"Sorry, I only respond to authorized parents.", ...}

# Child → home automation blocked (child mode)
curl -s localhost:8000/api/voice/command -H 'content-type: application/json' \
  -d '{"text":"Hey ParentAI, open the garage","speaker":"child_leo"}'
# => {"authorized":true,"executed":false,"denial_reason":"child_mode_block", ...}
```

### Full stack with Docker

```bash
cp .env.example .env       # optionally add cloud keys
docker compose up --build
```

- Backend API + docs: <http://localhost:8000/docs>
- Dashboard (React/MUI): <http://localhost:5173>
- Prometheus: <http://localhost:9090> · Grafana: <http://localhost:3000>

---

## Providers (swap by config)

| Capability | Providers | Default |
|---|---|---|
| Wake word | Porcupine · local keyword | `keyword` |
| Speech-to-text | Whisper (local) · mock | `mock` |
| Speaker verification | Azure · ElevenLabs · local ML (resemblyzer) · mock | `local_ml` |
| Conversation / LLM | OpenAI Responses API · mock | `mock` |
| Smart home | Home Assistant · Philips Hue · TP-Link Kasa · MQTT · AWS IoT · mock | auto |

Enable a provider by setting its env vars (see [`.env.example`](.env.example)),
e.g. `PARENTAI_SPEAKER_PROVIDER=azure` + `PARENTAI_AZURE_SPEECH_KEY=...`.

---

## Roles & permissions

| Role | Home automation | Security actions | Purchases | Educational | General |
|---|:---:|:---:|:---:|:---:|:---:|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Parent** (Harish, spouse) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Guest** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Child** (child mode) | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Unknown** | ❌ | ❌ | ❌ | ❌ | ❌ |

The matrix is **deny-by-default** and data-driven
([`app/domain/permissions.py`](backend/app/domain/permissions.py)); it can be
overridden per deployment/family without code changes.

---

## Project structure

```
backend/        FastAPI app: domain, providers, services, api, db, tests
frontend/       React + TypeScript + MUI dashboard
docker/         Prometheus config and container assets
terraform/      AWS (ECS Fargate) infrastructure as code
docs/           Architecture, deployment, security, developer, API guides
examples/       Ready-to-run request examples and a Python client
scripts/        Developer bootstrap / helper scripts
.github/        CI/CD (lint, type-check, test, security scan, image publish)
```

---

## Testing

```bash
cd backend && pytest -q      # 36 tests: permission matrix + end-to-end security
```

The suite proves the security guarantees: unknown/low-confidence/child/guest
rejection and authorized-parent execution.

---

## Documentation

- [Architecture & sequence diagrams](docs/architecture.md)
- [Deployment guide](docs/deployment.md)
- [Developer guide](docs/developer.md)
- [Security guide](docs/security.md)
- [API reference](docs/api.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Status & scope

The **security core, provider architecture, API, dashboard, tests, containers,
and CI are implemented and working**. Cloud provider adapters (Azure,
ElevenLabs, OpenAI, Home Assistant, Hue, Kasa, MQTT, AWS IoT) are real,
config-guarded integrations. Areas intentionally left as documented scaffolds:
full AWS Terraform hardening and the optional mobile/desktop apps. These are
called out where relevant so nothing is a hidden placeholder.

## License

MIT
