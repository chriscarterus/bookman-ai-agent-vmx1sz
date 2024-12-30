# Terraform Configuration Block
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Staging Environment State Configuration
  backend "s3" {
    bucket         = "bookman-terraform-state-staging"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "bookman-terraform-locks-staging"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = {
      Environment = "staging"
      Project     = "BookmanAI"
      ManagedBy   = "Terraform"
    }
  }
}

# AWS Infrastructure Module for Staging
module "aws_infrastructure" {
  source = "../../aws"

  # Core Infrastructure Settings
  aws_region         = "us-west-2"
  environment        = "staging"
  vpc_cidr          = "10.1.0.0/16"
  eks_cluster_version = "1.27"

  # Compute Resources Configuration
  eks_node_instance_types = ["t3.xlarge"]
  rds_instance_class     = "db.r6g.xlarge"
  elasticache_node_type  = "cache.r6g.large"

  # High Availability and Redundancy
  enable_multi_az = true

  # Security Configuration
  enable_encryption          = true
  enable_performance_insights = true
  enable_waf_protection      = true
  enable_cloudwatch_logs     = true

  # Backup and Recovery
  backup_retention_days = 35

  # Auto-scaling Configuration
  enable_auto_scaling = true

  # Resource Tagging
  tags = {
    Environment        = "staging"
    Project           = "BookmanAI"
    ManagedBy         = "Terraform"
    SecurityLevel     = "high"
    DataClassification = "confidential"
  }
}

# Output Definitions
output "vpc_id" {
  description = "ID of the VPC in staging environment"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster in staging"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Endpoint for the RDS instance in staging"
  value       = module.aws_infrastructure.database_endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Endpoint for the ElastiCache cluster in staging"
  value       = module.aws_infrastructure.redis_endpoint
  sensitive   = true
}

# Local Variables
locals {
  common_tags = {
    Environment = "staging"
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
    LastUpdated = timestamp()
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
  
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

data "aws_caller_identity" "current" {}