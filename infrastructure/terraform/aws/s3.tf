# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for KMS key alias
data "aws_kms_alias" "s3" {
  name = "alias/bookman-s3-${var.environment}"
}

# Data source for KMS key
data "aws_kms_key" "s3" {
  key_id = data.aws_kms_alias.s3.target_key_id
}

# User Files Bucket
resource "aws_s3_bucket" "user_files" {
  bucket        = "bookman-user-files-${var.environment}"
  force_destroy = false

  tags = {
    Name              = "Bookman User Files"
    Environment       = var.environment
    Purpose          = "User content storage"
    SecurityLevel    = "High"
    DataClassification = "Confidential"
    ManagedBy        = "Terraform"
  }
}

# Backup Bucket
resource "aws_s3_bucket" "backups" {
  bucket        = "bookman-backups-${var.environment}"
  force_destroy = false

  tags = {
    Name              = "Bookman Backups"
    Environment       = var.environment
    Purpose          = "System backups storage"
    SecurityLevel    = "Critical"
    DataClassification = "Restricted"
    ManagedBy        = "Terraform"
  }
}

# User Files Bucket Versioning
resource "aws_s3_bucket_versioning" "user_files_versioning" {
  bucket = aws_s3_bucket.user_files.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Backup Bucket Versioning
resource "aws_s3_bucket_versioning" "backups_versioning" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# User Files Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "user_files_encryption" {
  bucket = aws_s3_bucket.user_files.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Backup Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups_encryption" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# User Files Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "user_files_lifecycle" {
  bucket = aws_s3_bucket.user_files.id

  rule {
    id     = "transition_to_ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }

  rule {
    id     = "transition_to_glacier"
    status = "Enabled"

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

# Backup Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transition_to_glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# Public Access Block for User Files Bucket
resource "aws_s3_bucket_public_access_block" "user_files_access" {
  bucket = aws_s3_bucket.user_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Public Access Block for Backup Bucket
resource "aws_s3_bucket_public_access_block" "backups_access" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output for User Files Bucket
output "user_files_bucket" {
  description = "User files S3 bucket information"
  value = {
    id  = aws_s3_bucket.user_files.id
    arn = aws_s3_bucket.user_files.arn
  }
}

# Output for Backup Bucket
output "backup_bucket" {
  description = "Backup S3 bucket information"
  value = {
    id  = aws_s3_bucket.backups.id
    arn = aws_s3_bucket.backups.arn
  }
}