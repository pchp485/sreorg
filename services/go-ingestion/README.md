# Go Ingestion Service

The Go-based ingestion API handles event intake for the sreorg platform. It performs schema validation, enriches metadata, and pushes events into Amazon Kinesis for downstream processing by the Java alerting service.

## Features

- RESTful HTTP endpoint for accepting JSON event payloads.
- Validation using JSON Schema to ensure contract adherence.
- Writes events to Kinesis with partition keys derived from project identifiers.
- Exposes `/healthz` and `/readyz` for Kubernetes probes and `/metrics` for Prometheus scraping.
- Structured logging compatible with Splunk HEC ingestion.

## Local Development

1. Install Go 1.21 or newer.
2. Copy `.env.example` to `.env` and adjust AWS credentials or localstack endpoints.
3. Run the service locally:

   ```bash
   go run ./cmd/ingestion
   ```

4. Execute unit tests:

   ```bash
   go test ./...
   ```

## Containerization

A multi-stage Dockerfile is provided under `Dockerfile`. Build and tag the image with:

```bash
docker build -t sreorg/go-ingestion:dev .
```

## Deployment

Helm charts located in `charts/go-ingestion` define Kubernetes manifests with autoscaling and PodDisruptionBudgets. Spinnaker pipelines consume these charts during deployment.
