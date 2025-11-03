# sreorg Platform

This repository contains infrastructure-as-code, application services, and operational automation for a multi-region, highly-available Sentry-like monitoring platform running on AWS EKS. The solution spans infrastructure provisioning with Terraform, continuous delivery with Spinnaker and Jules, resiliency validation via AWS Fault Injection Service (FIS), and centralized observability using Splunk.

## Repository Layout

- `terraform/` – Terraform configuration broken into reusable modules and an example production environment spanning the required AWS regions.
- `services/` – Source code, Dockerfiles, and Helm charts for the Java and Go microservices that compose the Sentry-like application.
- `ci/` – Spinnaker pipeline definitions, Jules job specifications, and shared deployment assets.
- `fis/` – AWS FIS experiment templates and wrapper automation used for failure injection.
- `observability/` – Splunk integration assets, dashboards, and alert configurations.
- `docs/` – Design documents, runbooks, and onboarding material for operators and developers.

Each top-level directory contains its own README that describes how to work with that component in more detail.

## Getting Started

1. Review `docs/architecture-overview.md` for a high-level summary of the platform design and regional deployment model.
2. Customize the Terraform backend configuration under `terraform/environments/prod/backend.tf` for your AWS account and state storage solution (e.g., S3 + DynamoDB).
3. Use the Terraform configuration in `terraform/environments/prod` to provision the networking, IAM, and EKS infrastructure.
4. Build and publish the container images for the Java and Go services using the scripts in `services/` and the pipelines defined in `ci/spinnaker/`.
5. Deploy the application stack using Spinnaker's one-click pipeline execution once infrastructure and registries are ready.
6. Execute the FIS resiliency experiments described in `fis/` and confirm telemetry in Splunk dashboards under `observability/`.

## Prerequisites

- An AWS account with sufficient permissions to provision networking, IAM, EKS, and supporting services in multiple regions.
- Terraform CLI v1.5+.
- Docker for building container images.
- Access to a Spinnaker instance configured with AWS and Kubernetes providers.
- Access to a Splunk instance for ingesting and visualizing logs and metrics.

## Contributing

1. Create a feature branch for your changes.
2. Update or add unit/integration tests whenever applicable.
3. Run formatters and linters for Terraform (`terraform fmt`), Go (`go fmt`, `golangci-lint`), and Java (Gradle `spotlessApply` or Maven `fmt:format`).
4. Open a pull request describing your changes and link to any relevant FIS experiment or pipeline runs.

## License

This project is released under the MIT License. See `LICENSE` for details.
