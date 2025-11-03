output "spinnaker_role_arn" {
  description = "IAM role ARN for Spinnaker deployments"
  value       = aws_iam_role.spinnaker.arn
}

output "jules_role_arn" {
  description = "IAM role ARN for Jules automation"
  value       = aws_iam_role.jules.arn
}

output "fis_role_arn" {
  description = "IAM role ARN for AWS Fault Injection Service"
  value       = aws_iam_role.fis.arn
}

output "irsa_role_arn" {
  description = "IAM role ARN for Fluent Bit IRSA"
  value       = try(aws_iam_role.irsa[0].arn, null)
}
