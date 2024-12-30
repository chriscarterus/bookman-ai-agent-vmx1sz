# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get current AWS account ID for key policies
data "aws_caller_identity" "current" {}

# KMS key for RDS database encryption
resource "aws_kms_key" "rds_encryption_key" {
  description             = "KMS key for RDS database encryption with automatic rotation"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region           = true
  
  # Key policy allowing root account full access and enabling key rotation
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS Service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:ListGrants",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "bookman-rds-encryption-key"
    Environment = var.environment
    Purpose     = "RDS Encryption"
    Compliance  = "PCI-DSS,SOC2,ISO27001"
    ManagedBy   = "Terraform"
  }
}

# KMS key for secrets and sensitive data encryption
resource "aws_kms_key" "secrets_encryption_key" {
  description             = "KMS key for secrets and sensitive data encryption with enhanced security"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region           = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager Service"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "bookman-secrets-encryption-key"
    Environment = var.environment
    Purpose     = "Secrets Encryption"
    Compliance  = "PCI-DSS,SOC2,ISO27001"
    ManagedBy   = "Terraform"
  }
}

# KMS key for EBS volume encryption
resource "aws_kms_key" "ebs_encryption_key" {
  description             = "KMS key for EBS volume encryption with compliance controls"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region           = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow EBS Service"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "bookman-ebs-encryption-key"
    Environment = var.environment
    Purpose     = "EBS Encryption"
    Compliance  = "PCI-DSS,SOC2,ISO27001"
    ManagedBy   = "Terraform"
  }
}

# KMS alias for RDS encryption key
resource "aws_kms_alias" "rds_key_alias" {
  name          = "alias/bookman-${var.environment}-rds"
  target_key_id = aws_kms_key.rds_encryption_key.key_id
}

# KMS alias for secrets encryption key
resource "aws_kms_alias" "secrets_key_alias" {
  name          = "alias/bookman-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets_encryption_key.key_id
}

# KMS alias for EBS encryption key
resource "aws_kms_alias" "ebs_key_alias" {
  name          = "alias/bookman-${var.environment}-ebs"
  target_key_id = aws_kms_key.ebs_encryption_key.key_id
}

# Output the KMS key ARNs and IDs for use in other modules
output "rds_kms_key_arn" {
  description = "ARN of the KMS key used for RDS encryption"
  value       = aws_kms_key.rds_encryption_key.arn
}

output "secrets_kms_key_arn" {
  description = "ARN of the KMS key used for secrets encryption"
  value       = aws_kms_key.secrets_encryption_key.arn
}

output "ebs_kms_key_arn" {
  description = "ARN of the KMS key used for EBS encryption"
  value       = aws_kms_key.ebs_encryption_key.arn
}

output "rds_kms_key_id" {
  description = "ID of the KMS key used for RDS encryption"
  value       = aws_kms_key.rds_encryption_key.key_id
}

output "secrets_kms_key_id" {
  description = "ID of the KMS key used for secrets encryption"
  value       = aws_kms_key.secrets_encryption_key.key_id
}

output "ebs_kms_key_id" {
  description = "ID of the KMS key used for EBS encryption"
  value       = aws_kms_key.ebs_encryption_key.key_id
}