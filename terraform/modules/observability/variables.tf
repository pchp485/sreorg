variable "name" {
  description = "Name prefix"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "splunk_hec_token" {
  description = "Splunk HEC token"
  type        = string
}

variable "splunk_endpoint" {
  description = "Splunk HEC endpoint"
  type        = string
}

variable "log_groups" {
  description = "List of CloudWatch log group names to forward"
  type        = list(string)
  default     = []
}
