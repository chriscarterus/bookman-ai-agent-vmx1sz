# AWS Region Configuration
variable "aws_region" {
  description = "AWS region where infrastructure will be deployed"
  type        = string
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier"
  }
}

# Environment Configuration
variable "environment" {
  description = "Environment name (e.g., staging, production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either staging or production"
  }
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# EKS Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.27"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be a valid Kubernetes version"
  }
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS node groups"
  type        = list(string)
  default     = ["r6g.xlarge", "r6g.2xlarge"]

  validation {
    condition     = alltrue([for t in var.eks_node_instance_types : can(regex("^[a-z][0-9][a-z]\\.[a-z]+$", t))])
    error_message = "EKS node instance types must be valid AWS instance types"
  }
}

# RDS Configuration
variable "rds_instance_class" {
  description = "Instance class for RDS instances"
  type        = string
  default     = "db.r6g.2xlarge"

  validation {
    condition     = can(regex("^db\\.(t3|r6g|r6i)\\.", var.rds_instance_class))
    error_message = "RDS instance class must be a valid instance type"
  }
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

# Security Configuration
variable "enable_encryption" {
  description = "Enable encryption for all supported services"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 35

  validation {
    condition     = var.backup_retention_days >= 35
    error_message = "Backup retention must be at least 35 days"
  }
}

# Resource Tagging
variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project    = "BookmanAI"
    ManagedBy  = "Terraform"
  }
}