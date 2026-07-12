# Architecture

ParentAI is built as a **modular monolith with service-shaped boundaries**: one
deployable FastAPI application whose internal modules map 1:1 to the services in
the reference architecture. Each module depends only on abstract interfaces
(providers) and the pure domain, so any module can be extracted into its own
process later without rewrites. This gives microservice-grade separation of
concerns without premature operational complexity.

## Component overview

```mermaid
flowchart TB
    subgraph Clients
      Web[Web dashboard<br/>React + MUI]
      Device[Voice device / mobile]
    end

    subgraph Gateway["API Gateway (FastAPI)"]
      REST[REST /api/*]
      WS[WebSocket /ws/voice]
      Auth[Auth / JWT / RBAC]
      RL[Rate limiter]
    end

    subgraph Core["Secure Voice Pipeline (domain core)"]
      WW[Wake-word gate]
      STT[Speech-to-text]
      SV[Speaker verification]
      AUTHZ[Authorization / role]
      INT[Intent extraction]
      PERM[Permission policy<br/>child mode]
      EXE[Execution]
    end

    subgraph Providers["Pluggable providers"]
      P1[Porcupine / keyword]
      P2[Whisper]
      P3[Azure / ElevenLabs / local ML]
      P4[OpenAI Responses]
      P5[Home Assistant / Hue / Kasa<br/>MQTT / AWS IoT]
    end

    subgraph Data
      PG[(PostgreSQL)]
      REDIS[(Redis<br/>session memory)]
    end

    subgraph Observability
      LOG[Structured JSON logs]
      PROM[Prometheus]
      OTEL[OpenTelemetry / Jaeger]
    end

    Web --> REST
    Device --> WS
    REST --> Auth --> Core
    WS --> Core
    RL --- Gateway
    WW --> STT --> SV --> AUTHZ --> INT --> PERM --> EXE
    WW -.-> P1
    STT -.-> P2
    SV -.-> P3
    INT -.-> P4
    EXE -.-> P5
    EXE --> REDIS
    Auth --> PG
    Core --> LOG --> PROM
    Core --> OTEL
```

## Sequence: an authorized parent command

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Harish)
    participant G as API Gateway
    participant P as Pipeline
    participant SV as Speaker Verify
    participant PL as Permission Policy
    participant D as Device Provider
    participant A as Audit

    U->>G: "Hey ParentAI, turn off the lights" (+ voice)
    G->>P: process(audio)
    P->>P: transcribe + detect wake word ✅
    P->>SV: verify(audio, candidates, threshold)
    SV-->>P: accepted=true, user=harish, conf=0.98
    P->>A: audit(speaker_verification, verified)
    P->>P: extract intent → home_automation/turn_off
    P->>PL: evaluate(parent, home_automation)
    PL-->>P: allowed
    P->>D: execute(turn_off downstairs_lights)
    D-->>P: ok
    P->>A: audit(execution, success)
    P-->>G: "Turned off downstairs lights."
    G-->>U: spoken response
```

## Sequence: unknown speaker (rejected)

```mermaid
sequenceDiagram
    autonumber
    participant U as Unknown speaker
    participant P as Pipeline
    participant SV as Speaker Verify
    participant A as Audit

    U->>P: "Hey ParentAI, unlock the front door" (+ voice)
    P->>P: transcribe + wake word ✅
    P->>SV: verify(...)
    SV-->>P: accepted=false (no match / low confidence)
    P->>A: audit(speaker_verification, UNAUTHORIZED) ⚠️
    P-->>U: "Sorry, I only respond to authorized parents."
    Note over P: No intent extraction, no execution — fail closed.
```

## Sequence: child mode block

```mermaid
sequenceDiagram
    autonumber
    participant C as Child (verified)
    participant P as Pipeline
    participant PL as Permission Policy

    C->>P: "Hey ParentAI, open the garage" (+ voice)
    P->>P: verify ✅ (role=child) → intent security_action/open
    P->>PL: evaluate(child, security_action)
    PL-->>P: denied (child_mode_block)
    P-->>C: "I can't lock or unlock doors for you. Please ask Mom or Dad."
    Note over P: Speaker authorized, but the action is refused.
```

## Design principles

- **Fail closed.** Any verification error or provider outage results in
  rejection, never accidental authorization.
- **Deny by default.** The permission policy grants nothing unless explicitly
  listed for a role.
- **Open/closed providers.** New speech/LLM/device backends are added as classes
  selected by config — the pipeline never changes.
- **Pure, testable core.** Domain and policy have no I/O; the security rules are
  exhaustively unit tested.
- **Observability first-class.** Every stage emits structured audit events;
  auth failures and unauthorized attempts are surfaced as metrics for alerting.

## Mapping to the reference microservices

| Reference service | Module |
|---|---|
| api-gateway | `app/main.py`, `app/api/*` |
| wakeword-service | `app/providers/wakeword/*` |
| speech-service | `app/providers/stt/*` |
| speaker-verification-service | `app/providers/speaker/*` |
| intent-service | `app/providers/llm/intent_rules.py` |
| llm-service | `app/providers/llm/*` |
| device-service | `app/providers/devices/*` |
| auth-service | `app/services/auth_service.py`, `app/api/deps.py` |
| logging/metrics-service | `app/logging_config.py`, `app/telemetry.py`, `app/services/audit.py` |
| web-dashboard | `frontend/` |
