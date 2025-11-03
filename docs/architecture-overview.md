# Architecture Overview

This document outlines the end-to-end design for the sreorg platform, covering infrastructure, application services, deployment automation, and operational observability. The goal is to provide a single reference for engineers standing up or maintaining the multi-region environment.

## Regional Topology

The platform operates across three AWS regions:

| Region Role | AWS Region | Purpose |
|-------------|------------|---------|
| Active 1    | us-east-1  | Primary production traffic, low-latency access for east coast clients |
| Active 2    | us-east-2  | Active-active failover for resiliency and geographic diversity |
| Passive     | us-west-2  | Disaster recovery region kept warm with limited capacity |

Key design considerations:

- **Active-active routing** between the east regions using Route53 latency-based or weighted records and AWS Global Accelerator.
- **Shared services** such as container registries and centralized logging reside in us-east-1 but are designed with cross-region replication or backups.
- **Data plane isolation** ensures each region has dedicated VPCs, subnets, and EKS clusters to minimize blast radius.
- **Control plane redundancy** for Spinnaker and supporting services either via managed offerings or multi-AZ deployments in us-east-1.

## Networking

Each region provisions the following components using Terraform modules:

- A `/16` VPC segmented into three `/20` private subnets and three `/24` public subnets across different Availability Zones.
- Public subnets host NAT Gateways and ingress controllers when required; private subnets host EKS worker nodes and internal services.
- VPC Flow Logs stream to CloudWatch Logs and forward into Splunk via Kinesis Firehose.
- Optional Transit Gateway attachments provide centralized connectivity for shared services when needed; otherwise, VPC peering is used for limited cross-region traffic.

## Kubernetes Layer

- **EKS Control Plane**: Managed by AWS across three Availability Zones per region, with encryption at rest enabled and audit logs shipped to CloudWatch.
- **Node Groups**: Managed node groups per workload tier (`system`, `application`, `analytics`). Autoscaling is configured with minimum and maximum capacity to balance cost and availability.
- **Add-ons**: CoreDNS, kube-proxy, VPC CNI, Cluster Autoscaler, AWS Load Balancer Controller, External DNS, Metrics Server, and Fluent Bit for log shipping.

## Application Services

Two primary microservices implement the Sentry-like functionality:

1. **Ingestion API (Go)**
   - Accepts event payloads over HTTP with JSON schema validation.
   - Persists normalized events into Amazon Kinesis Data Streams for downstream processing.
   - Exposes Prometheus metrics and health probes for Kubernetes readiness/liveness.

2. **Processing & Alerting (Java)**
   - Consumes events from Kinesis, enriches them, and stores results in Amazon DynamoDB.
   - Emits alert notifications to Amazon SNS topics for downstream integrations.
   - Publishes structured logs and performance metrics for Splunk ingestion.

Both services ship with Helm charts that include PodDisruptionBudgets, HorizontalPodAutoscalers, and PodSecurityStandards aligned with the CIS benchmark.

## CI/CD Flow

1. Source changes pushed to Git trigger build jobs that compile, test, and build container images.
2. Artifacts publish to Amazon ECR with region replication enabled between us-east-1 and us-east-2.
3. Spinnaker pipelines orchestrate deployments to dev, staging, and prod EKS clusters using Jules for canary and blue/green strategies.
4. Feature flags and configuration are managed via AWS AppConfig with staged rollouts orchestrated by pipeline steps.

## Resiliency Validation

AWS Fault Injection Service templates model scenarios such as:

- Terminating all nodes in a node group to validate pod rescheduling and multi-AZ resilience.
- Introducing 500ms latency to DynamoDB endpoints via network disruption templates.
- Simulating a full region failure by disabling Route53 health checks and withdrawing traffic from an active region.

A Python-based wrapper script automates experiment selection, execution, and result aggregation, integrating with Splunk for post-experiment analysis.

## Observability & Monitoring

- **Logging**: Fluent Bit forwards container logs to CloudWatch, from which Kinesis Firehose streams to Splunk HTTP Event Collector (HEC).
- **Metrics**: Prometheus Operator collects application and infrastructure metrics, with alerting rules mirrored into Splunk for centralized alerting.
- **Tracing**: AWS X-Ray instrumentation for both services provides distributed tracing across API and processing workflows.
- **Dashboards**: Splunk dashboards track ingestion rate, processing latency, pod health, and pipeline execution status. Dedicated panels highlight FIS experiment timelines against observed metrics.

## Security & Compliance

- Infrastructure managed via Terraform with code reviews and automated policy checks (OPA/Conftest).
- IAM roles follow least privilege principles; IRSA links EKS service accounts to scoped IAM policies.
- Secrets managed with AWS Secrets Manager and mounted into pods via the Secrets Store CSI driver.
- Audit logging enabled across AWS services with centralized retention policies.

## Future Enhancements

- Integrate chaos engineering scenarios beyond FIS, such as application-level fault injection.
- Add automated disaster recovery drills for the passive region, including data restoration validation.
- Expand Splunk dashboards with business-level KPIs.
- Introduce cost optimization reporting across clusters and supporting services.
