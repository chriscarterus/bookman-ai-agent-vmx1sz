# Provider and Backend Configuration
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

  backend "s3" {
    bucket         = "bookman-terraform-state"
    key            = "aws/${var.environment}/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "bookman-terraform-locks"
    kms_key_id     = aws_kms_key.terraform_state.arn
  }
}

# Primary Region Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment   = var.environment
      Project       = "BookmanAI"
      ManagedBy     = "Terraform"
      CostCenter    = "Infrastructure"
      SecurityLevel = "High"
    }
  }
}

# Secondary Region Provider for DR
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "BookmanAI"
      ManagedBy   = "Terraform"
      Role        = "DR"
    }
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

# KMS Key for State Encryption
resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for Terraform state encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "terraform-state-key"
  }
}

# Primary Region Resources
module "primary_vpc" {
  source = "./vpc"
  
  vpc_cidr     = var.vpc_cidr
  environment  = var.environment
  region       = var.aws_region
  azs          = data.aws_availability_zones.available.names
}

module "primary_eks" {
  source = "../../modules/eks"
  
  cluster_name    = "bookman-${var.environment}"
  vpc_id          = module.primary_vpc.vpc_id
  subnet_ids      = module.primary_vpc.private_subnets
  instance_types  = var.eks_node_instance_types
  cluster_version = var.eks_cluster_version
}

# Security Group for Database Access
resource "aws_security_group" "database" {
  name_prefix = "bookman-db-"
  vpc_id      = module.primary_vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.primary_eks.cluster_security_group_id]
  }
}

# RDS Instance
resource "aws_db_instance" "primary" {
  identifier        = "bookman-${var.environment}"
  engine            = "postgres"
  engine_version    = "15.3"
  instance_class    = var.rds_instance_class
  allocated_storage = 100
  
  multi_az               = var.enable_multi_az
  db_subnet_group_name   = module.primary_vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.database.id]
  
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  storage_encrypted = var.enable_encryption
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn         = aws_iam_role.rds_monitoring.arn
  
  deletion_protection = true
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "bookman-${var.environment}"
  engine              = "redis"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = 2
  parameter_group_family = "redis6.x"
  port                = 6379
  
  subnet_group_name    = module.primary_vpc.elasticache_subnet_group
  security_group_ids   = [aws_security_group.redis.id]
  
  snapshot_retention_limit = 7
  snapshot_window         = "05:00-06:00"
  
  at_rest_encryption_enabled = var.enable_encryption
  transit_encryption_enabled = var.enable_encryption
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "bookman-${var.environment}"
  description = "WAF rules for Bookman AI platform"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "BookmanWAFMetric"
    sampled_requests_enabled  = true
  }
}

# Shield Advanced
resource "aws_shield_protection" "alb" {
  name         = "bookman-alb-protection"
  resource_arn = module.primary_vpc.alb_arn
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/bookman/${var.environment}"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.logs.arn
}

# Backup Vault
resource "aws_backup_vault" "main" {
  name        = "bookman-${var.environment}"
  kms_key_arn = aws_kms_key.backup.arn
}

# Backup Plan
resource "aws_backup_plan" "main" {
  name = "bookman-${var.environment}"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * * *)"
    
    lifecycle {
      delete_after = var.backup_retention_days
    }
  }
}

# Outputs
output "eks_cluster_endpoint" {
  value = module.primary_eks.cluster_endpoint
}

output "vpc_id" {
  value = module.primary_vpc.vpc_id
}

output "database_endpoint" {
  value = aws_db_instance.primary.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}