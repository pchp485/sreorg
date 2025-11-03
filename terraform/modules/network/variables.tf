variable "name" {
  description = "Name prefix for networking resources"
  type        = string
}

variable "cidr_block" {
  description = "Primary CIDR block for the VPC"
  type        = string
}

variable "az_count" {
  description = "Number of Availability Zones to span"
  type        = number
  default     = 3
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private subnets"
  type        = list(string)
}

variable "enable_flow_logs" {
  description = "Whether to enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "flow_log_destination_arn" {
  description = "Destination ARN (CloudWatch Log Group or S3) for flow logs"
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags to apply to resources"
  type        = map(string)
  default     = {}
}
