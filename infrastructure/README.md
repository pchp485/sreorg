# Infrastructure

This directory holds environment/observability infrastructure that complements
the application deployment.

| Path | Purpose |
|---|---|
| [`../terraform/`](../terraform) | AWS (ECS Fargate) infrastructure as code |
| [`../docker/prometheus.yml`](../docker/prometheus.yml) | Prometheus scrape config used by the compose stack |
| [`../docker-compose.yml`](../docker-compose.yml) | Local full stack (backend, frontend, Postgres, Redis, Prometheus, Grafana) |

## Observability stack

`docker compose up` starts Prometheus (`:9090`) scraping the backend `/metrics`
endpoint and Grafana (`:3000`, admin/admin). Add the Prometheus data source in
Grafana pointing at `http://prometheus:9090` and import a dashboard using the
`parentai_*` metrics:

- `parentai_pipeline_requests_total{outcome}` — command outcomes
- `parentai_auth_failures_total{reason}` — **alert on this** (unauthorized attempts)
- `parentai_pipeline_latency_seconds` — end-to-end latency histogram

## Tracing

Set `PARENTAI_OTEL_EXPORTER_ENDPOINT` (e.g. an OTLP/Jaeger collector) to enable
distributed tracing of the FastAPI app; install the `observability` extra.
