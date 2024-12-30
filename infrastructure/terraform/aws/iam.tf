# AWS Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# EKS Cluster Assume Role Policy Document
data "aws_iam_policy_document" "eks_cluster_assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:eks:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/*"]
    }
  }
}

# RDS Monitoring Assume Role Policy Document
data "aws_iam_policy_document" "rds_monitoring_assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster_role" {
  name                 = "bookman-${var.environment}-eks-cluster-role"
  assume_role_policy   = data.aws_iam_policy_document.eks_cluster_assume_role.json
  permissions_boundary = "arn:aws:iam::aws:policy/boundary/AdminPermissionsBoundary"
  force_detach_policies = true
  max_session_duration = 3600

  tags = {
    Environment        = var.environment
    Project           = "BookmanAI"
    ManagedBy         = "Terraform"
    SecurityLevel     = "Critical"
    DataClassification = "Confidential"
  }
}

# EKS Cluster Policy Attachment
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

# RDS Enhanced Monitoring Role
resource "aws_iam_role" "rds_monitoring_role" {
  name                 = "bookman-${var.environment}-rds-monitoring-role"
  assume_role_policy   = data.aws_iam_policy_document.rds_monitoring_assume_role.json
  permissions_boundary = "arn:aws:iam::aws:policy/boundary/DatabasePermissionsBoundary"
  force_detach_policies = true
  max_session_duration = 3600

  tags = {
    Environment        = var.environment
    Project           = "BookmanAI"
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    DataClassification = "Sensitive"
  }
}

# RDS Monitoring Policy Attachment
resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_monitoring_role.name
}

# Custom EKS Security Policy
resource "aws_iam_policy" "eks_security_policy" {
  name        = "bookman-${var.environment}-eks-security-policy"
  description = "Enhanced security policy for EKS cluster"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
        }
      },
      {
        Effect = "Deny"
        Action = [
          "eks:DeleteCluster",
          "eks:DeleteNodegroup"
        ]
        Resource = "arn:aws:eks:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.environment}-*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalTag/SecurityLevel": "Critical"
          }
        }
      }
    ]
  })
}

# Attach custom security policy to EKS cluster role
resource "aws_iam_role_policy_attachment" "eks_security_policy" {
  policy_arn = aws_iam_policy.eks_security_policy.arn
  role       = aws_iam_role.eks_cluster_role.name
}

# Outputs
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster_role.arn
}

output "rds_monitoring_role_arn" {
  description = "ARN of the RDS monitoring IAM role"
  value       = aws_iam_role.rds_monitoring_role.arn
}