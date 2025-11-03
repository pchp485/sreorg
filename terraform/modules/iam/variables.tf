variable "name" {
  description = "Name prefix"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

variable "spinnaker_principals" {
  description = "List of IAM principal ARNs allowed to assume the Spinnaker role"
  type        = list(string)
  default     = []
}

variable "jules_principals" {
  description = "List of IAM principal ARNs allowed to assume the Jules role"
  type        = list(string)
  default     = []
}

variable "fis_principals" {
  description = "List of IAM principal ARNs allowed to start FIS experiments"
  type        = list(string)
  default     = []
}

variable "cluster_oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA"
  type        = string
  default     = null
}
