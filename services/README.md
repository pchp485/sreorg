# Application Services

This directory houses the microservices that compose the sreorg application stack.

- `go-ingestion/`: Go-based ingestion API accepting event payloads and forwarding them to AWS Kinesis.
- `java-processing/`: Spring Boot service responsible for event enrichment, persistence, and alerting.

Each service contains:

- Source code and build configuration.
- Dockerfiles for container image builds.
- Helm charts for Kubernetes deployment via Spinnaker and Jules.
- Documentation covering local development and operational guidance.
