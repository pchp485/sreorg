# AWS Fault Injection Service (FIS)

This directory contains experiment templates and automation for validating platform resiliency.

## Contents

- `experiments/`: JSON templates defining failure scenarios such as regional outages, node terminations, and network latency injection.
- `scripts/`: Wrapper scripts used to orchestrate experiments, capture results, and publish status updates to Splunk.
- `dashboards/`: Splunk dashboard configuration capturing experiment metrics and timelines.

## Wrapper Script

`scripts/run_experiment.py` accepts experiment names, loads variables from environment or parameter files, and executes the corresponding AWS FIS template. It records experiment IDs, monitors status, and emits summaries to stdout and Splunk HEC.

```bash
python scripts/run_experiment.py --experiment regional-outage --duration 900 \
  --region us-east-1 --splunk-hec-token $SPLUNK_HEC_TOKEN
```

## Operational Guidance

1. Ensure AWS IAM principals used for FIS have permissions defined in the Terraform `modules/iam` output.
2. Dry run experiments in staging clusters before production execution.
3. Coordinate with on-call engineers and communicate expected impacts via pre-defined Slack channels.
4. After experiment completion, review Splunk dashboards and export findings into runbooks.
