# Provider configuration with version constraints
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Local variables for common configurations
locals {
  common_tags = {
    Environment     = "production"
    ManagedBy      = "terraform"
    ServiceName    = "bookman-ai"
    CreatedDate    = timestamp()
  }
}

# KMS key for cluster encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster ${var.cluster_name} encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(var.tags, local.common_tags)
}

# IAM role for EKS cluster
resource "aws_iam_role" "eks_cluster" {
  name = "${var.cluster_name}-cluster-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })
  
  permissions_boundary = var.cluster_role_permissions_boundary
  tags                = merge(var.tags, local.common_tags)
}

# Attach required policies to cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# Security group for cluster
resource "aws_security_group" "cluster" {
  name_prefix = "${var.cluster_name}-cluster-sg"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    cidr_blocks = var.cluster_endpoint_private_access_cidrs
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.tags, local.common_tags)
}

# EKS cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.cluster_version
  
  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = var.enable_private_endpoint
    endpoint_public_access  = var.enable_public_endpoint
    security_group_ids      = [aws_security_group.cluster.id]
  }
  
  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }
  
  enabled_cluster_log_types = var.cluster_log_types
  
  tags = merge(var.tags, local.common_tags)
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# IAM role for node groups
resource "aws_iam_role" "eks_nodes" {
  name = "${var.cluster_name}-node-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  
  permissions_boundary = var.node_role_permissions_boundary
  tags                = merge(var.tags, local.common_tags)
}

# Attach required policies to node role
resource "aws_iam_role_policy_attachment" "eks_node_policies" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ])
  
  policy_arn = each.value
  role       = aws_iam_role.eks_nodes.name
}

# EKS node groups
resource "aws_eks_node_group" "worker_nodes" {
  for_each = var.node_groups
  
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.subnet_ids
  
  scaling_config {
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
    min_size     = each.value.min_size
  }
  
  instance_types = each.value.instance_types
  capacity_type  = each.value.capacity_type
  
  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }
  
  labels = each.value.labels
  
  tags = merge(var.tags, local.common_tags)
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_node_policies
  ]
}

# EKS add-ons
resource "aws_eks_addon" "addons" {
  for_each = var.enable_cluster_addons
  
  cluster_name = aws_eks_cluster.main.name
  addon_name   = each.key
  addon_version = each.value.version
  
  resolve_conflicts = each.value.resolve_conflicts
  
  service_account_role_arn = each.value.service_account_role_arn != "" ? each.value.service_account_role_arn : null
  
  tags = merge(var.tags, local.common_tags)
}

# Outputs
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.cluster.id
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN of the EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}