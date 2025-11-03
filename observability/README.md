# Observability

Artifacts in this directory define Splunk integrations, dashboards, and alert policies for the sreorg platform.

## Splunk Integration

- `hec-config.json`: Example HTTP Event Collector configuration referencing tokens provisioned via Terraform.
- `inputs/`: Source type definitions aligning Kubernetes logs and metrics to Splunk indexes.
- `dashboards/`: XML or JSON export of dashboards visualizing ingestion throughput, processing latency, and FIS experiment timelines.

## Deployment

1. Configure Splunk HEC endpoints according to `hec-config.json`.
2. Use the Splunk REST API or UI to import dashboards and saved searches.
3. Validate data flow by triggering synthetic events through the Go ingestion service and verifying they appear in Splunk with appropriate sourcetypes.

## Alerting

Alert rules notify the on-call rotation via PagerDuty when:

- Ingestion rate deviates more than 30% from the 7-day baseline.
- Processing latency exceeds SLA for 5 consecutive minutes.
- FIS experiments exceed expected blast radius or fail to complete.

Alert artifacts reside under `alerts/` with step-by-step import instructions.
