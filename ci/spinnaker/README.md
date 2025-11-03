# Spinnaker Pipelines

This directory contains declarative Spinnaker pipeline definitions and supporting artifacts for the sreorg platform. Pipelines are defined using the Spinnaker Managed Pipeline Templates v2 (MPTv2) format and can be applied via the Spinnaker Gate API or the `spin` CLI.

## Pipelines

- `ingestion-delivery.json`: Builds, tests, and deploys the Go ingestion service across dev, staging, and prod environments with automated canary analysis via Jules.
- `processing-delivery.json`: Performs equivalent steps for the Java processing service, including database migrations and validation gates.
- `infrastructure-rollout.json`: Handles Terraform-driven infrastructure updates using Spinnaker's Terraform integration stage with manual judgement gates.

## Usage

1. Authenticate to Spinnaker using Gate or the `spin` CLI.
2. Apply the templates:

   ```bash
   spin pipeline-template save --file ingestion-delivery.json
   spin pipeline-template save --file processing-delivery.json
   spin pipeline save --file pipelines/ingestion-prod.json
   ```

3. Trigger pipelines either automatically via Git events or manually through the Spinnaker UI.

## Integration with Jules

Jules (Apache Mesos) is used for advanced deployment strategies such as canary and blue/green. Pipelines include stages that submit Jules jobs referencing Kubernetes manifests packaged as Helm charts. Jules configuration files reside under `ci/spinnaker/jules/`.

## Secrets Management

Sensitive values (AWS credentials, Splunk tokens, etc.) should be sourced from Spinnaker's secret engine integrations (e.g., HashiCorp Vault, AWS Secrets Manager). Pipeline definitions reference logical secret names rather than hard-coded values.
