# Terraform Configuration

The Terraform codebase provisions the multi-region AWS foundation for the sreorg platform. It is structured around reusable modules and an example production environment spanning two active regions in North America East and one passive region in North America West.

## Directory Layout

- `modules/`
  - `network/`: Provisions regional VPCs, subnets, route tables, NAT gateways, and VPC Flow Logs.
  - `eks/`: Creates Amazon EKS clusters, node groups, and core add-ons.
  - `iam/`: Defines IAM roles and policies for Terraform, EKS IRSA, Spinnaker, Jules, and FIS.
  - `observability/`: Deploys supporting resources for log aggregation, metrics, and Splunk integration.
- `environments/prod/`: Root module composition targeting the production topology described in the project brief.

## Usage

1. Configure the remote backend in `environments/prod/backend.tf` before running any Terraform commands.
2. Export AWS credentials with permission to create networking, IAM, EKS, CloudWatch, and FIS resources across `us-east-1`, `us-east-2`, and `us-west-2`.
3. Initialize Terraform and run a plan:

   ```bash
   cd environments/prod
   terraform init
   terraform workspace select prod || terraform workspace new prod
   terraform plan -var-file=prod.tfvars
   ```

4. Apply the plan when ready:

   ```bash
   terraform apply -var-file=prod.tfvars
   ```

5. Output values provide kubeconfig, VPC identifiers, and other integration data for downstream automation.

## Conventions

- All modules expose inputs via `variables.tf` with sensible defaults. Overrides should occur in environment `*.tfvars` files.
- `terraform fmt` must be run before commits.
- Validate plans with `terraform validate` and optional `tflint` or `opa` policy checks.

## State & Locking

Use an S3 bucket with server-side encryption for state and a DynamoDB table for state locking. Example configuration is provided in `backend.tf` but requires customization per account.

## Next Steps

- Add additional environments (e.g., `environments/staging`) as needed by copying the production configuration and adjusting capacity variables.
- Integrate Terraform Cloud or Atlantis for automated plan/apply workflows triggered via pull requests.
