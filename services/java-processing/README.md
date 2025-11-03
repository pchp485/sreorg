# Java Processing Service

The Java processing and alerting service consumes events from Amazon Kinesis, enriches context, and delivers alerts to downstream systems.

## Features

- Kinesis consumer leveraging the AWS SDK for Java v2.
- DynamoDB persistence with TTL for event retention.
- SNS-based alert fan-out with configurable templates.
- Micrometer metrics exported to Prometheus and Splunk.
- Graceful handling of poison-pill events via Dead Letter Queue integration.

## Local Development

This service is built with Spring Boot 3.x and Gradle.

```bash
./gradlew bootRun
```

Run tests with:

```bash
./gradlew test
```

Docker image builds via:

```bash
./gradlew bootBuildImage
```

Helm charts live under `charts/java-processing` for Kubernetes deployment.
