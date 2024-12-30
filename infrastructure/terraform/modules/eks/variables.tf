# Core Terraform configuration for variable validation
terraform {
  required_version = "~> 1.0"
}

# Cluster Configuration Variables
variable "cluster_name" {
  description = "Name of the EKS cluster - must be unique within the AWS region"
  type        = string
  
  validation {
    condition     = length(var.cluster_name) <= 40 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be 40 characters or less and start with a letter, containing only alphanumeric characters and hyphens."
  }
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster - must be supported by AWS EKS"
  type        = string
  default     = "1.27"
  
  validation {
    condition     = can(regex("^1\\.(2[5-7])$", var.cluster_version))
    error_message = "Cluster version must be between 1.25 and 1.27."
  }
}

# Networking Configuration Variables
variable "vpc_id" {
  description = "ID of the VPC where EKS cluster will be deployed - must have appropriate networking configuration"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs across multiple AZs for high availability deployment of EKS cluster and worker nodes"
  type        = list(string)
}

# Node Group Configuration Variables
variable "node_groups" {
  description = "Map of node group configurations for different workload types"
  type = map(object({
    desired_size   = number
    min_size      = number
    max_size      = number
    instance_types = list(string)
    capacity_type  = string
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  
  default = {
    default = {
      desired_size   = 3
      min_size      = 3
      max_size      = 10
      instance_types = ["r6g.xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        environment = "production"
        workload    = "general"
      }
      taints = []
    }
  }

  validation {
    condition     = alltrue([for k, v in var.node_groups : v.min_size <= v.desired_size && v.desired_size <= v.max_size])
    error_message = "For each node group, min_size must be <= desired_size <= max_size."
  }

  validation {
    condition     = alltrue([for k, v in var.node_groups : contains(["ON_DEMAND", "SPOT"], v.capacity_type)])
    error_message = "Node group capacity_type must be either ON_DEMAND or SPOT."
  }
}

# Security Configuration Variables
variable "enable_cluster_encryption" {
  description = "Enable envelope encryption for Kubernetes secrets using AWS KMS"
  type        = bool
  default     = true
}

variable "cluster_log_types" {
  description = "List of control plane logging types to enable for audit and monitoring"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  validation {
    condition     = alltrue([for log_type in var.cluster_log_types : contains(["api", "audit", "authenticator", "controllerManager", "scheduler"], log_type)])
    error_message = "Invalid log type specified. Valid values are: api, audit, authenticator, controllerManager, scheduler."
  }
}

# Network Access Configuration Variables
variable "enable_private_endpoint" {
  description = "Enable private API endpoint access for enhanced security"
  type        = bool
  default     = true
}

variable "enable_public_endpoint" {
  description = "Enable public API endpoint access - recommended to be disabled in production"
  type        = bool
  default     = false
}

# CIDR Block Configuration Variables
variable "cluster_endpoint_private_access_cidrs" {
  description = "List of CIDR blocks that can access the Amazon EKS private API server endpoint"
  type        = list(string)
  default     = ["10.0.0.0/8"]

  validation {
    condition     = alltrue([for cidr in var.cluster_endpoint_private_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All elements must be valid CIDR blocks."
  }
}

# Resource Tagging Variables
variable "tags" {
  description = "Tags to apply to all resources created by this module for resource management"
  type        = map(string)
  default     = {}

  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum of 50 tags can be specified."
  }
}

# Add-on Configuration Variables
variable "enable_cluster_addons" {
  description = "Map of EKS add-ons to enable with their versions"
  type        = map(object({
    version               = string
    resolve_conflicts     = string
    service_account_role_arn = string
  }))
  default = {
    vpc-cni = {
      version               = "v1.12.0"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
    coredns = {
      version               = "v1.9.3"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
    kube-proxy = {
      version               = "v1.27.1"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
  }
}

# IAM Configuration Variables
variable "cluster_role_permissions_boundary" {
  description = "ARN of the policy that is used to set the permissions boundary for the cluster role"
  type        = string
  default     = null
}

variable "node_role_permissions_boundary" {
  description = "ARN of the policy that is used to set the permissions boundary for the node role"
  type        = string
  default     = null
}