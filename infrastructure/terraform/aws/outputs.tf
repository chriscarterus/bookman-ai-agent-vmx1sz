# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC where all resources are deployed"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "List of private subnet IDs for secure workload deployment"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of public subnet IDs for load balancer and NAT gateway deployment"
  value       = module.vpc.public_subnets
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_name" {
  description = "The name of the EKS cluster for resource tagging and identification"
  value       = module.eks.cluster_name
}

output "eks_security_group_id" {
  description = "The security group ID attached to the EKS cluster for network access control"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority" {
  description = "The certificate authority data for the EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_iam_role_arn" {
  description = "The IAM role ARN used by the EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

# RDS Outputs
output "postgresql_endpoint" {
  description = "The connection endpoint for the PostgreSQL RDS instance"
  value       = module.rds.postgresql_endpoint
  sensitive   = true
}

output "timescaledb_endpoint" {
  description = "The connection endpoint for the TimescaleDB RDS instance"
  value       = module.rds.timescaledb_endpoint
  sensitive   = true
}

output "database_security_groups" {
  description = "Security group IDs for database access control"
  value       = module.rds.security_group_ids
}

# Tags Output
output "common_tags" {
  description = "Common tags applied to all resources"
  value = {
    Project     = "BookmanAI"
    Environment = var.environment
    ManagedBy   = "Terraform"
    CreatedDate = timestamp()
  }
}

# Network Configuration
output "nat_gateway_ips" {
  description = "List of Elastic IPs associated with NAT Gateways"
  value       = module.vpc.nat_gateway_ips
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = var.vpc_cidr
}

# Monitoring and Logging
output "cloudwatch_log_groups" {
  description = "CloudWatch Log Groups created for infrastructure monitoring"
  value = {
    vpc_flow_logs = "/aws/vpc/bookman-${var.environment}-flow-logs"
    eks_logs      = "/aws/eks/bookman-${var.environment}/cluster"
    rds_logs      = "/aws/rds/instance/bookman-${var.environment}-*"
  }
}

# Resource Counts
output "resource_counts" {
  description = "Count of various infrastructure resources deployed"
  value = {
    private_subnets = length(module.vpc.private_subnets)
    public_subnets  = length(module.vpc.public_subnets)
    nat_gateways    = length(module.vpc.nat_gateway_ips)
    rds_instances   = 2  # PostgreSQL and TimescaleDB
  }
}