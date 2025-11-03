locals {
  cluster_role_arn = var.iam_role_arn != null ? var.iam_role_arn : aws_iam_role.cluster[0].arn
  node_role_arn    = var.node_role_arn != null ? var.node_role_arn : aws_iam_role.node[0].arn
}

resource "aws_iam_role" "cluster" {
  count = var.iam_role_arn == null ? 1 : 0

  name = "${var.name}-cluster"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster" {
  count = var.iam_role_arn == null ? 1 : 0

  role       = aws_iam_role.cluster[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "node" {
  count = var.node_role_arn == null ? 1 : 0

  name = "${var.name}-node"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  count = var.node_role_arn == null ? 1 : 0

  role       = aws_iam_role.node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  count = var.node_role_arn == null ? 1 : 0

  role       = aws_iam_role.node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "node_ec2" {
  count = var.node_role_arn == null ? 1 : 0

  role       = aws_iam_role.node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "node_ssm" {
  count = var.node_role_arn == null ? 1 : 0

  role       = aws_iam_role.node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_eks_cluster" "this" {
  name                      = "${var.name}-cluster"
  role_arn                  = local.cluster_role_arn
  version                   = var.cluster_version
  enabled_cluster_log_types = var.cluster_log_types

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  dynamic "encryption_config" {
    for_each = []
    content {
      provider {
        key_arn = null
      }
      resources = ["secrets"]
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name}-cluster"
  })
}

resource "aws_eks_addon" "this" {
  for_each = { for addon in var.addons : addon.name => addon }

  cluster_name = aws_eks_cluster.this.name
  addon_name   = each.value.name
  addon_version = try(each.value.version, null)

  tags = var.tags
}

resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.name}-system"
  node_role_arn   = local.node_role_arn
  subnet_ids      = var.subnet_ids
  instance_types  = [var.system_node_group.instance_type]

  scaling_config {
    desired_size = var.system_node_group.desired_capacity
    max_size     = var.system_node_group.max_capacity
    min_size     = 1
  }

  tags = merge(var.tags, {
    Name = "${var.name}-system"
    Tier = "system"
  })
}

resource "aws_eks_node_group" "application" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.name}-app"
  node_role_arn   = local.node_role_arn
  subnet_ids      = var.subnet_ids
  instance_types  = [var.instance_type]

  scaling_config {
    desired_size = var.desired_capacity
    max_size     = var.max_capacity
    min_size     = 2
  }

  tags = merge(var.tags, {
    Name = "${var.name}-app"
    Tier = "application"
  })
}
