locals {
  tags = merge(var.tags, {
    Component = var.name
  })
}

resource "aws_iam_role" "spinnaker" {
  name = "${var.name}-spinnaker"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = var.spinnaker_principals
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "spinnaker" {
  name = "${var.name}-spinnaker"
  role = aws_iam_role.spinnaker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["eks:*", "autoscaling:*", "cloudformation:*", "iam:PassRole", "ec2:*", "ssm:GetParameter"],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "jules" {
  name = "${var.name}-jules"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = var.jules_principals
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "jules" {
  name = "${var.name}-jules"
  role = aws_iam_role.jules.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["eks:DescribeCluster", "eks:ListClusters", "eks:UpdateClusterConfig", "eks:UpdateNodegroupConfig", "ec2:DescribeInstances", "autoscaling:*", "iam:PassRole"],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "fis" {
  name = "${var.name}-fis"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = var.fis_principals
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "fis" {
  name = "${var.name}-fis"
  role = aws_iam_role.fis.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "ec2:RebootInstances",
          "ec2:StopInstances",
          "ec2:TerminateInstances",
          "eks:UpdateNodegroupConfig",
          "ssm:SendCommand"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "irsa" {
  count = var.cluster_oidc_provider_arn == null ? 0 : 1

  name = "${var.name}-irsa-fluentbit"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.cluster_oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "oidc.eks.amazonaws.com/id/${replace(var.cluster_oidc_provider_arn, "arn:aws:iam::", "")}:sub" = "system:serviceaccount:observability:fluent-bit"
          }
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "irsa" {
  count = var.cluster_oidc_provider_arn == null ? 0 : 1

  name = "${var.name}-irsa-fluentbit"
  role = aws_iam_role.irsa[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:PutLogEvents", "logs:CreateLogStream", "logs:DescribeLogStreams"],
        Resource = "*"
      }
    ]
  })
}
