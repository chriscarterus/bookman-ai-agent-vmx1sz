# AWS Provider configuration with version constraints
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

# Data source for existing VPC
data "aws_vpc" "main" {
  id = var.vpc_id
}

# Data source for private subnets
data "aws_subnet_ids" "private" {
  vpc_id = data.aws_vpc.main.id
  tags = {
    Type = "private"
  }
}

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster" {
  name = "bookman-${var.environment}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }
}

# Attach required policies to cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS Node Group IAM Role
resource "aws_iam_role" "eks_node_group" {
  name = "bookman-${var.environment}-eks-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }
}

# Attach required policies to node group role
resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}

# KMS key for EKS encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "bookman-${var.environment}-eks"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids              = data.aws_subnet_ids.private.ids
    endpoint_private_access = true
    endpoint_public_access  = false
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# General Purpose Node Group
resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "bookman-${var.environment}-general"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = data.aws_subnet_ids.private.ids

  scaling_config {
    desired_size = 3
    min_size     = 3
    max_size     = 10
  }

  instance_types = ["r6g.xlarge"]

  labels = {
    role        = "general"
    environment = var.environment
  }

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry
  ]
}

# ML Workload Node Group
resource "aws_eks_node_group" "ml" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "bookman-${var.environment}-ml"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = data.aws_subnet_ids.private.ids

  scaling_config {
    desired_size = 2
    min_size     = 2
    max_size     = 5
  }

  instance_types = ["g5.2xlarge"]

  labels = {
    role        = "ml"
    environment = var.environment
  }

  taint {
    key    = "workload"
    value  = "ml"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry
  ]
}

# EKS Cluster Security Group
resource "aws_security_group" "eks_cluster" {
  name        = "bookman-${var.environment}-eks-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bookman-${var.environment}-eks-cluster-sg"
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster endpoint URL"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.eks_cluster.id
}