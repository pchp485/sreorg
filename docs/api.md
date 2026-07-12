# API Reference

Interactive OpenAPI docs are served at `/docs` (Swagger UI) and
`/openapi.json`. Summary below.

## Voice

### `POST /api/voice/command`
Text-based command through the full secure pipeline.

Request:
```json
{ "text": "Hey ParentAI, turn off the downstairs lights",
  "session_id": "living-room",
  "speaker": "harish",
  "confidence": 0.99 }
```
`speaker`/`confidence` simulate a verified identity for text clients using the
mock speaker provider. With audio providers the identity comes from the voice.

Response (`CommandResponse`):
```json
{ "authorized": true, "executed": true,
  "spoken_response": "Turned off downstairs lights.",
  "transcript": "Hey ParentAI, turn off the downstairs lights",
  "denial_reason": null, "confidence": 0.99,
  "user_id": "harish", "role": "parent",
  "intent": { "category": "home_automation", "action": "turn_off",
              "target": "downstairs_lights", "parameters": {} } }
```

### `POST /api/voice/audio`
Multipart audio upload (`audio` file, `session_id` form field). Same response.

### `WS /ws/voice`
Send `{ "text": "...", "speaker": "harish", "session_id": "..." }`. Authorized
conversational replies stream as `{type:"delta", text}` chunks; denials arrive
as a single `{type:"final", ...}` message.

## Users & auth (admin/parent)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users/{id}/token` | Issue a JWT (dev login; OAuth2 in prod) |
| `GET`  | `/api/users` | List users *(admin/parent)* |
| `POST` | `/api/users/{id}/enroll` | Upload a voice sample *(admin/parent)* |
| `POST` | `/api/users/{id}/enabled?enabled=bool` | Enable/disable a user |

Authenticate with `Authorization: Bearer <token>`.

## Devices / audit / permissions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/devices` | Inventory across all device providers |
| `GET` | `/api/audit?limit=N` | Recent audit events *(admin/parent)* |
| `GET` | `/api/permissions` | Effective role → categories matrix |

## Health / metrics

| Path | Description |
|---|---|
| `/health/live` | Liveness |
| `/health/ready` | Readiness |
| `/health` | Detailed status + selected providers |
| `/metrics` | Prometheus metrics |
