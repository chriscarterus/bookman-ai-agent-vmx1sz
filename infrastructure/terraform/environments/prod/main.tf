# Production Environment Terraform Configuration
# Version: 1.0.0
# Provider versions:
# - AWS Provider v5.0+
# - Kubernetes Provider v2.23+
# - Random Provider v3.5+

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

  # Production state management with encryption and locking
  backend "s3" {
    bucket         = "bookman-terraform-state-prod"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "bookman-terraform-locks-prod"
    
    # Enhanced state management settings
    versioning     = true
    kms_key_id     = "alias/terraform-bucket-key"
    
    # State locking settings
    dynamodb_table = "bookman-terraform-locks-prod"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = {
      Environment   = "production"
      Project       = "BookmanAI"
      ManagedBy     = "Terraform"
      SecurityLevel = "High"
      CostCenter    = "Infrastructure"
    }
  }

  # Enhanced retry configuration for production
  retry_mode  = "adaptive"
  max_retries = 5
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
  
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# Main AWS Infrastructure Module
module "aws_infrastructure" {
  source = "../../aws"

  # Core Infrastructure Settings
  aws_region         = "us-west-2"
  environment        = "production"
  vpc_cidr          = "10.0.0.0/16"

  # EKS Configuration
  eks_cluster_version    = "1.27"
  eks_node_instance_types = ["r6g.xlarge", "r6g.2xlarge"]

  # Database Configuration
  rds_instance_class    = "db.r6g.2xlarge"
  elasticache_node_type = "cache.r6g.large"

  # Domain and DNS Configuration
  domain_name = "bookman.ai"

  # Security Configuration
  enable_encryption = true
  enable_waf        = true
  enable_shield     = true

  # High Availability Configuration
  multi_az = true

  # Backup and Monitoring Configuration
  backup_retention_period     = 30
  enable_performance_insights = true
  enable_enhanced_monitoring = true

  # Additional Production Settings
  tags = {
    Environment   = "production"
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    SecurityLevel = "High"
    CostCenter    = "Infrastructure"
  }
}

# Production-specific outputs
output "vpc_id" {
  description = "ID of the production VPC"
  value       = module.aws_infrastructure.vpc_id
  sensitive   = false
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the production EKS cluster"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Endpoint of the production RDS instance"
  value       = module.aws_infrastructure.database_endpoint
  sensitive   = true
}

# Additional production-specific outputs
output "redis_endpoint" {
  description = "Endpoint of the production Redis cluster"
  value       = module.aws_infrastructure.redis_endpoint
  sensitive   = true
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.aws_infrastructure.cloudfront_distribution_id
  sensitive   = false
}

output "waf_web_acl_id" {
  description = "ID of the WAF web ACL"
  value       = module.aws_infrastructure.waf_web_acl_id
  sensitive   = false
}