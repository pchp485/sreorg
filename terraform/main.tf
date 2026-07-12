# ParentAI — AWS ECS Fargate deployment.
#
# Provisions the production topology: networking, an ECS Fargate service behind
# an ALB, RDS PostgreSQL, ElastiCache Redis, Secrets Manager for config, S3 for
# voice profiles, and CloudWatch logs. Review IAM/TLS/networking against your
# org baseline before applying to a real account.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  name = "parentai-${var.environment}"
  tags = {
    Project     = "ParentAI"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# --- Networking -------------------------------------------------------
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.tags, { Name = local.name })
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${local.name}-public-${count.index}" })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = merge(local.tags, { Name = "${local.name}-private-${count.index}" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = local.tags
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = local.tags
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Security groups --------------------------------------------------
resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

resource "aws_security_group" "service" {
  name_prefix = "${local.name}-svc-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

# --- Secrets ----------------------------------------------------------
resource "aws_secretsmanager_secret" "config" {
  name = "${local.name}-config"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "config" {
  secret_id = aws_secretsmanager_secret.config.id
  secret_string = jsonencode({
    PARENTAI_JWT_SECRET  = var.jwt_secret
    PARENTAI_DATABASE_URL = "postgresql+asyncpg://parentai:${var.db_password}@${aws_db_instance.postgres.address}:5432/parentai"
    PARENTAI_REDIS_URL   = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/0"
  })
}

# --- Data stores ------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name}-pg"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  db_name                 = "parentai"
  username                = "parentai"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.service.id]
  storage_encrypted       = true
  skip_final_snapshot     = var.environment != "prod"
  backup_retention_period = var.environment == "prod" ? 7 : 1
  tags                    = local.tags
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.service.id]
  tags                 = local.tags
}

resource "aws_s3_bucket" "voice_profiles" {
  bucket = "${local.name}-voice-profiles"
  tags   = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "voice_profiles" {
  bucket = aws_s3_bucket.voice_profiles.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- Logs & ECS -------------------------------------------------------
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = local.tags
}

# IAM, task definition, ALB target group/listener, and service are defined in
# ecs.tf to keep this file focused on infra primitives.
