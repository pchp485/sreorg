output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Cluster CA certificate"
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "system_node_group_name" {
  description = "System node group name"
  value       = aws_eks_node_group.system.id
}

output "application_node_group_name" {
  description = "Application node group name"
  value       = aws_eks_node_group.application.id
}
