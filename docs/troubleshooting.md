# Troubleshooting

### Every command says "no wake word detected" (`denial_reason: no_wake_word`)
The utterance must contain a configured wake word ("hey parentai" or "hey
jarvis"). Include it in `text`, or adjust `PARENTAI_WAKE_WORDS`.

### An authorized parent is rejected as unauthorized
- With the **mock** provider, `speaker` must match a seeded user id
  (`harish`, `spouse`, `admin`, `child_leo`, `guest`) and `confidence` must be
  ≥ `PARENTAI_SPEAKER_CONFIDENCE_THRESHOLD` (default 0.75).
- With a **real** provider, the user needs an enrolled voice profile and the
  match score must clear the threshold. Enroll via
  `POST /api/users/{id}/enroll`.
- Check the user isn't disabled (`enabled=false` removes them from candidates).

### `local_ml` logs "resemblyzer unavailable … NOT secure"
The local speaker provider fell back to a deterministic, **non-secure**
embedding. Install the real model: `pip install ".[speaker]"`. Never run the
fallback in production.

### Provider is "skipped: not configured" at startup
Expected — that provider's env vars aren't set, so it's omitted and the system
falls back (mock device provider is always available). Set the relevant
`PARENTAI_*` vars to enable it.

### Redis "unavailable; using in-memory session store"
The app couldn't reach `PARENTAI_REDIS_URL` and fell back to in-process memory
(fine for single-instance/dev). For multi-instance, ensure Redis is reachable.

### `/metrics` returns 404
Metrics require `prometheus-client` (`pip install ".[observability]"`) and
`PARENTAI_METRICS_ENABLED=true`.

### 401 on `/api/users` or `/api/audit`
These require a bearer token. Get one: `POST /api/users/admin/token`, then send
`Authorization: Bearer <token>`.

### CORS errors from the dashboard
In non-local environments `allow_origins` is restricted. Add your dashboard
origin in `app/main.py`'s CORS middleware configuration.

### Cloud provider calls fail behind a proxy / TLS
Ensure outbound HTTPS is permitted to the provider endpoints (Azure, ElevenLabs,
OpenAI). The adapters fail closed, so verification failures reject rather than
allow.
