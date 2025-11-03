variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region"
  type        = string
  default     = "us-east-2"
}

variable "dr_region" {
  description = "Disaster recovery AWS region"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Global resource tags"
  type        = map(string)
  default = {
    Project     = "sreorg"
    Environment = "prod"
  }
}

variable "splunk_hec_token" {
  description = "Splunk HEC token"
  type        = string
}

variable "splunk_endpoint" {
  description = "Splunk HEC endpoint"
  type        = string
}

variable "spinnaker_principals" {
  description = "Principals allowed to assume the Spinnaker role"
  type        = list(string)
  default     = []
}

variable "jules_principals" {
  description = "Principals allowed to assume the Jules role"
  type        = list(string)
  default     = []
}

variable "fis_principals" {
  description = "Principals allowed to assume the FIS role"
  type        = list(string)
  default     = []
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "secondary_vpc_cidr" {
  description = "Secondary region VPC CIDR"
  type        = string
  default     = "10.1.0.0/16"
}

variable "dr_vpc_cidr" {
  description = "DR region VPC CIDR"
  type        = string
  default     = "10.2.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs for primary region"
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs for primary region"
  type        = list(string)
  default     = ["10.0.16.0/20", "10.0.32.0/20", "10.0.48.0/20"]
}

variable "secondary_public_subnet_cidrs" {
  description = "Public subnet CIDRs for secondary region"
  type        = list(string)
  default     = ["10.1.0.0/24", "10.1.1.0/24", "10.1.2.0/24"]
}

variable "secondary_private_subnet_cidrs" {
  description = "Private subnet CIDRs for secondary region"
  type        = list(string)
  default     = ["10.1.16.0/20", "10.1.32.0/20", "10.1.48.0/20"]
}

variable "dr_public_subnet_cidrs" {
  description = "Public subnet CIDRs for DR region"
  type        = list(string)
  default     = ["10.2.0.0/24", "10.2.1.0/24", "10.2.2.0/24"]
}

variable "dr_private_subnet_cidrs" {
  description = "Private subnet CIDRs for DR region"
  type        = list(string)
  default     = ["10.2.16.0/20", "10.2.32.0/20", "10.2.48.0/20"]
}
