module "primary_network" {
  source = "../../modules/network"

  providers = {
    aws = aws
  }

  name                   = "sreorg-pri"
  cidr_block             = var.vpc_cidr
  public_subnet_cidrs    = var.public_subnet_cidrs
  private_subnet_cidrs   = var.private_subnet_cidrs
  flow_log_destination_arn = null
  tags                   = var.tags
}

module "secondary_network" {
  source = "../../modules/network"

  providers = {
    aws = aws.secondary
  }

  name                   = "sreorg-sec"
  cidr_block             = var.secondary_vpc_cidr
  public_subnet_cidrs    = var.secondary_public_subnet_cidrs
  private_subnet_cidrs   = var.secondary_private_subnet_cidrs
  flow_log_destination_arn = null
  tags                   = var.tags
}

module "dr_network" {
  source = "../../modules/network"

  providers = {
    aws = aws.dr
  }

  name                 = "sreorg-dr"
  cidr_block           = var.dr_vpc_cidr
  public_subnet_cidrs  = var.dr_public_subnet_cidrs
  private_subnet_cidrs = var.dr_private_subnet_cidrs
  tags                 = var.tags
}

module "primary_eks" {
  source = "../../modules/eks"

  providers = {
    aws = aws
  }

  name          = "sreorg-pri"
  subnet_ids    = module.primary_network.private_subnet_ids
  vpc_id        = module.primary_network.vpc_id
  tags          = var.tags
  iam_role_arn  = null
  node_role_arn = null
}

module "secondary_eks" {
  source = "../../modules/eks"

  providers = {
    aws = aws.secondary
  }

  name          = "sreorg-sec"
  subnet_ids    = module.secondary_network.private_subnet_ids
  vpc_id        = module.secondary_network.vpc_id
  tags          = var.tags
  iam_role_arn  = null
  node_role_arn = null
}

module "dr_eks" {
  source = "../../modules/eks"

  providers = {
    aws = aws.dr
  }

  name          = "sreorg-dr"
  subnet_ids    = module.dr_network.private_subnet_ids
  vpc_id        = module.dr_network.vpc_id
  tags          = var.tags
  desired_capacity = 1
  max_capacity     = 2
  iam_role_arn     = null
  node_role_arn    = null
}

module "iam" {
  source = "../../modules/iam"

  name                 = "sreorg"
  tags                 = var.tags
  spinnaker_principals = var.spinnaker_principals
  jules_principals     = var.jules_principals
  fis_principals       = var.fis_principals
  cluster_oidc_provider_arn = null
}

module "observability" {
  source = "../../modules/observability"

  name            = "sreorg"
  tags            = var.tags
  splunk_hec_token = var.splunk_hec_token
  splunk_endpoint  = var.splunk_endpoint
  log_groups       = [
    "/aws/eks/sreorg-pri/cluster",
    "/aws/eks/sreorg-sec/cluster"
  ]
}
