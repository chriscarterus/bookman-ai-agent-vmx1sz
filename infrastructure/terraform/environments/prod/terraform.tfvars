# AWS Region Configuration
# Primary production region in US West (Oregon)
aws_region = "us-west-2"

# Environment Identifier
# Used for resource naming and tagging
environment = "production"

# Network Configuration
# Production VPC with large CIDR range for multiple subnets
vpc_cidr = "10.0.0.0/16"

# EKS Cluster Configuration
# Using latest stable Kubernetes version with production-grade instances
eks_cluster_version = "1.27"
eks_node_instance_types = [
  "r6g.xlarge",   # Primary instance type for general workloads
  "r6g.2xlarge"   # Higher capacity instances for resource-intensive workloads
]

# RDS Configuration
# Production-grade database instance with high availability
rds_instance_class = "db.r6g.2xlarge"
enable_multi_az    = true
enable_encryption  = true

# Backup Configuration
# Extended retention period for compliance requirements
backup_retention_days = 35

# Resource Tags
# Comprehensive tagging strategy for production environment
tags = {
  Project             = "BookmanAI"
  Environment         = "production"
  ManagedBy          = "Terraform"
  CostCenter         = "PROD-001"
  DataClassification = "Confidential"
}