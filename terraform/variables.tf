variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod)."
  type        = string
  default     = "dev"
}

variable "image" {
  description = "Backend container image (e.g. ghcr.io/OWNER/REPO/backend:latest)."
  type        = string
}

variable "desired_count" {
  description = "Number of Fargate tasks."
  type        = number
  default     = 2
}

variable "container_port" {
  description = "Backend container port."
  type        = number
  default     = 8000
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL (store in tfvars/secret)."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (>= 32 bytes)."
  type        = string
  sensitive   = true
}
