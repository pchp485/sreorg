output "alb_dns_name" {
  description = "Public DNS name of the load balancer (point Route53/CDN here)."
  value       = aws_lb.main.dns_name
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "database_endpoint" {
  value     = aws_db_instance.postgres.address
  sensitive = true
}

output "voice_profiles_bucket" {
  value = aws_s3_bucket.voice_profiles.bucket
}
