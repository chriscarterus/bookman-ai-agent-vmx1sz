# RDS Instance Identifier Configuration
variable "identifier_prefix" {
  description = "Prefix for RDS instance identifiers"
  type        = string
  default     = "bookman"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.identifier_prefix))
    error_message = "Identifier prefix must start with a letter and only contain lowercase letters, numbers, and hyphens"
  }
}

# Instance Configuration
variable "instance_class" {
  description = "RDS instance class for optimal performance"
  type        = string
  default     = "db.r6g.2xlarge"

  validation {
    condition     = can(regex("^db\\.(r6g|r6i|x2g)\\.(2xlarge|4xlarge|8xlarge|12xlarge|16xlarge)$", var.instance_class))
    error_message = "Instance class must be a valid RDS graviton instance type for production workloads"
  }
}

# Engine Configuration
variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.3"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.engine_version))
    error_message = "Engine version must be a valid PostgreSQL version"
  }
}

# Storage Configuration
variable "allocated_storage" {
  description = "Initial storage allocation in GB"
  type        = number
  default     = 100

  validation {
    condition     = var.allocated_storage >= 100 && var.allocated_storage <= 65536
    error_message = "Allocated storage must be between 100 GB and 65,536 GB"
  }
}

variable "max_allocated_storage" {
  description = "Maximum auto-scaling storage in GB"
  type        = number
  default     = 1000

  validation {
    condition     = var.max_allocated_storage >= 100 && var.max_allocated_storage <= 65536
    error_message = "Maximum allocated storage must be between 100 GB and 65,536 GB"
  }
}

variable "storage_type" {
  description = "Storage type for RDS instances"
  type        = string
  default     = "gp3"

  validation {
    condition     = contains(["gp3", "io1"], var.storage_type)
    error_message = "Storage type must be either gp3 or io1 for production workloads"
  }
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

# High Availability Configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Network Configuration
variable "subnet_ids" {
  description = "List of subnet IDs for RDS deployment"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability"
  }
}

variable "vpc_security_group_ids" {
  description = "List of VPC security group IDs"
  type        = list(string)

  validation {
    condition     = length(var.vpc_security_group_ids) >= 1
    error_message = "At least one security group ID is required"
  }
}

# Maintenance Configuration
variable "maintenance_window" {
  description = "Weekly maintenance window"
  type        = string
  default     = "Mon:00:00-Mon:03:00"

  validation {
    condition     = can(regex("^[A-Za-z]{3}:\\d{2}:\\d{2}-[A-Za-z]{3}:\\d{2}:\\d{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format Day:HH:MM-Day:HH:MM"
  }
}

# Backup Configuration
variable "backup_window" {
  description = "Daily backup window"
  type        = string
  default     = "03:00-06:00"

  validation {
    condition     = can(regex("^\\d{2}:\\d{2}-\\d{2}:\\d{2}$", var.backup_window))
    error_message = "Backup window must be in the format HH:MM-HH:MM"
  }
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 35

  validation {
    condition     = var.backup_retention_period >= 35 && var.backup_retention_period <= 365
    error_message = "Backup retention period must be between 35 and 365 days for production workloads"
  }
}

# Protection Configuration
variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7

  validation {
    condition     = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be 7 days or a multiple of 31 days up to 731 days"
  }
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 0, 1, 5, 10, 15, 30, or 60 seconds"
  }
}

# Update Configuration
variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

variable "copy_tags_to_snapshot" {
  description = "Copy tags to snapshots"
  type        = bool
  default     = true
}

# Resource Tagging
variable "tags" {
  description = "Tags to apply to RDS resources"
  type        = map(string)
  default     = {}
}