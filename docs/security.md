# Security Guide

Security is the product. This document describes the guarantees, the threat
model, and the controls.

## Core guarantee

> No protected action executes unless **(1)** a wake word is detected **and**
> **(2)** the speaker is verified as an enabled, authorized user whose role
> permits the requested action category.

This is enforced in one place — `SecureVoicePipeline.process`
([`app/services/pipeline.py`](../backend/app/services/pipeline.py)) — and proven
by the tests in [`tests/test_pipeline.py`](../backend/tests/test_pipeline.py).

## Threat model & controls

| Threat | Control |
|---|---|
| Stranger issues commands | Speaker verification rejects non-matching voices → *"Sorry, I only respond to authorized parents."* |
| Recording/low-quality spoof | Confidence threshold (`PARENTAI_SPEAKER_CONFIDENCE_THRESHOLD`); below-threshold matches are rejected |
| Child triggers home/security/purchases | Role-based **child mode**: those categories are denied with child-friendly refusals |
| Guest controls devices | Guests limited to general queries |
| Provider outage → accidental allow | **Fail-closed**: verification errors return "rejected", never "accepted" |
| Disabled/compromised account | `enabled=false` removes a user from verification candidates immediately |
| API abuse / brute force | Per-client rate limiting; auth-failure metrics for alerting |
| Token theft | Short-lived JWTs (`PARENTAI_JWT_EXPIRES_MINUTES`), role claims, HTTPS in transit |
| Tampering / repudiation | Structured, append-only audit log of every stage and decision |

## Authentication & authorization

- **Speaker (voice) authentication** gates the assistant itself — the primary
  control for spoken commands.
- **JWT / OAuth2** gates the dashboard/admin API. Tokens carry `sub` and `role`;
  admin/parent-only endpoints require the appropriate role.
- **RBAC** is deny-by-default and centralized in `app/domain/permissions.py`.

## Secrets & data protection

- All secrets are environment-driven (12-factor); never commit `.env`.
- In production use **AWS Secrets Manager** (see `terraform/`) — the app reads
  the same `PARENTAI_*` variables injected from Secrets Manager.
- **Encryption in transit**: terminate TLS at the load balancer / API Gateway.
- **Encryption at rest**: enable RDS and S3 encryption (Terraform variables).
- Voice profiles are stored as embeddings, not raw audio, and can be backed by
  encrypted S3/DB.

## Auditing & monitoring

- Every pipeline stage emits an audit event (`app/services/audit.py`).
- Unauthorized attempts log at `WARNING` and increment
  `parentai_auth_failures_total{reason=...}` — wire an alert on this metric.
- Latency and outcome are tracked via `parentai_pipeline_*` Prometheus metrics.

## Hardening checklist for production

- [ ] Set a strong `PARENTAI_JWT_SECRET` (≥ 32 bytes) from Secrets Manager.
- [ ] Use a real speaker provider (`azure` / `elevenlabs` / `local_ml` with
      resemblyzer) — the fallback embedding is **not** secure.
- [ ] Raise `PARENTAI_SPEAKER_CONFIDENCE_THRESHOLD` to fit your provider's ROC.
- [ ] Restrict CORS `allow_origins` to known dashboard origins.
- [ ] Enforce HTTPS and HSTS at the edge.
- [ ] Ship logs to a tamper-evident store; alert on auth-failure spikes.
- [ ] Run the CI security scan (Trivy + pip-audit) on every change.
