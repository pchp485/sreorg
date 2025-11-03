variable "name" {
  description = "Cluster name prefix"
  type        = string
}

variable "cluster_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "subnet_ids" {
  description = "Subnet IDs for the cluster"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID hosting the cluster"
  type        = string
}

variable "desired_capacity" {
  description = "Desired node count for application node group"
  type        = number
  default     = 3
}

variable "max_capacity" {
  description = "Maximum node count for application node group"
  type        = number
  default     = 6
}

variable "instance_type" {
  description = "Instance type for worker nodes"
  type        = string
  default     = "m6i.xlarge"
}

variable "system_node_group" {
  description = "Configuration for system node group"
  type = object({
    desired_capacity = number
    max_capacity     = number
    instance_type    = string
  })
  default = {
    desired_capacity = 2
    max_capacity     = 4
    instance_type    = "m6i.large"
  }
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}

variable "cluster_log_types" {
  description = "Control plane log types"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "addons" {
  description = "EKS add-ons to enable"
  type = list(object({
    name    = string
    version = optional(string)
  }))
  default = [
    { name = "vpc-cni" },
    { name = "coredns" },
    { name = "kube-proxy" }
  ]
}

variable "cluster_security_group_additional_rules" {
  description = "Additional security group rules"
  type = list(object({
    description              = string
    from_port                = number
    to_port                  = number
    protocol                 = string
    cidr_blocks              = optional(list(string), [])
    source_security_group_id = optional(string)
  }))
  default = []
}

variable "iam_role_arn" {
  description = "IAM role ARN for the EKS cluster if pre-provisioned"
  type        = string
  default     = null
}

variable "node_role_arn" {
  description = "IAM role ARN for the node groups if pre-provisioned"
  type        = string
  default     = null
}
