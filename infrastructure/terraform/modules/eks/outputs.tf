# Cluster Access Information
output "cluster_endpoint" {
  description = "EKS cluster endpoint URL for secure API access and service communication"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "Name identifier of the EKS cluster for resource tagging and operational reference"
  value       = aws_eks_cluster.main.name
}

output "cluster_security_group_id" {
  description = "ID of the EKS cluster security group for network policy and access control configuration"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for secure cluster authentication and API communication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "OpenID Connect issuer URL for configuring IAM roles for service accounts (IRSA)"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "node_security_group_id" {
  description = "ID of the EKS node group security group for worker node network configuration and access control"
  value       = aws_eks_cluster.main.vpc_config[0].security_group_ids[0]
}

output "cluster_version" {
  description = "Kubernetes version of the EKS cluster for version compatibility checks"
  value       = aws_eks_cluster.main.version
}

output "cluster_arn" {
  description = "ARN of the EKS cluster for IAM and resource policy configuration"
  value       = aws_eks_cluster.main.arn
}

output "cluster_platform_version" {
  description = "Platform version of the EKS cluster for feature compatibility verification"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_status" {
  description = "Current status of the EKS cluster for operational monitoring"
  value       = aws_eks_cluster.main.status
}

output "cluster_primary_security_group_id" {
  description = "ID of the EKS cluster's primary security group for pod networking configuration"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_role_arn" {
  description = "ARN of the IAM role used by the EKS cluster for service operations"
  value       = aws_eks_cluster.main.role_arn
}

output "cluster_addons" {
  description = "Map of enabled EKS add-ons with their versions and configurations"
  value = {
    for addon in aws_eks_cluster.main.addon : addon.name => {
      version = addon.version
      status  = addon.status
    }
  }
}

output "node_groups" {
  description = "Map of EKS node groups with their configurations and status"
  value = {
    for ng_key, ng in aws_eks_node_group.worker_nodes : ng_key => {
      status          = ng.status
      capacity_type   = ng.capacity_type
      instance_types  = ng.instance_types
      scaling_config  = ng.scaling_config
      node_role_arn   = ng.node_role_arn
    }
  }
}