output "primary_cluster_name" {
  value       = module.primary_eks.cluster_name
  description = "Primary region EKS cluster name"
}

output "secondary_cluster_name" {
  value       = module.secondary_eks.cluster_name
  description = "Secondary region EKS cluster name"
}

output "dr_cluster_name" {
  value       = module.dr_eks.cluster_name
  description = "Disaster recovery region EKS cluster name"
}

output "spinnaker_role_arn" {
  value       = module.iam.spinnaker_role_arn
  description = "Role ARN assumed by Spinnaker"
}

output "jules_role_arn" {
  value       = module.iam.jules_role_arn
  description = "Role ARN assumed by Jules"
}

output "fis_role_arn" {
  value       = module.iam.fis_role_arn
  description = "Role ARN for AWS Fault Injection Service"
}
