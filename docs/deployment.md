# Deployment Guide

## Local (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

Brings up backend, frontend, PostgreSQL, Redis, Prometheus, and Grafana. The
backend runs with local/mock providers unless you set cloud `PARENTAI_*` keys.

## Database migrations

```bash
cd backend
pip install -e ".[db]"
export PARENTAI_DATABASE_URL=postgresql+asyncpg://parentai:parentai@localhost:5432/parentai
alembic upgrade head
```

## AWS (ECS Fargate) with Terraform

The `terraform/` module provisions a production-shaped stack: VPC, ECS Fargate
service behind an Application Load Balancer, RDS PostgreSQL, ElastiCache Redis,
Secrets Manager, S3 (voice profiles), and CloudWatch logs.

```bash
cd terraform
terraform init
terraform plan  -var 'environment=prod' -var 'image=ghcr.io/OWNER/REPO/backend:latest'
terraform apply -var 'environment=prod' -var 'image=ghcr.io/OWNER/REPO/backend:latest'
```

Configuration (`PARENTAI_*`) is delivered to the task as environment variables
sourced from **Secrets Manager**, so no secrets live in the image or task
definition.

> The Terraform here is a working scaffold that captures the topology and wiring.
> Review IAM scoping, TLS certificates (ACM), and networking against your
> organization's baseline before applying to a real account.

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR:

1. **Backend** — ruff lint, mypy (advisory), pytest.
2. **Frontend** — TypeScript build.
3. **Security** — Trivy filesystem scan + pip-audit.
4. **Docker** (on `main`) — build & push backend/frontend images to GHCR.

Add a deploy job that calls `aws ecs update-service --force-new-deployment`
(or `terraform apply`) after images publish to complete the pipeline.

## Health & readiness

- `GET /health/live` — liveness (process up).
- `GET /health/ready` — readiness (pipeline assembled).
- `GET /health` — detailed status incl. selected providers.
- `GET /metrics` — Prometheus exposition.

Point your load balancer/orchestrator health checks at `/health/live`.
