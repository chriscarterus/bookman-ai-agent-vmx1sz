# PostgreSQL RDS Instance Outputs
output "postgresql_endpoint" {
  description = "Connection endpoint for PostgreSQL RDS instance running on r6g.2xlarge for user data storage with ACID compliance"
  value       = module.postgresql.db_instance_endpoint
}

output "postgresql_security_group_id" {
  description = "Security group ID controlling access to PostgreSQL RDS instance with enhanced security measures"
  value       = module.postgresql.security_group_id
}

output "postgresql_arn" {
  description = "ARN of the PostgreSQL RDS instance for IAM policy and resource access management"
  value       = module.postgresql.db_instance_arn
}

# TimescaleDB RDS Instance Outputs
output "timescaledb_endpoint" {
  description = "Connection endpoint for TimescaleDB RDS instance optimized for market data time-series storage"
  value       = module.timescaledb.db_instance_endpoint
}

output "timescaledb_security_group_id" {
  description = "Security group ID controlling access to TimescaleDB RDS instance with enhanced security measures"
  value       = module.timescaledb.security_group_id
}

output "timescaledb_arn" {
  description = "ARN of the TimescaleDB RDS instance for IAM policy and resource access management"
  value       = module.timescaledb.db_instance_arn
}

# Combined Database Information Output
output "database_info" {
  description = "Combined information about both database instances including endpoints and security groups"
  value = {
    postgresql = {
      endpoint        = module.postgresql.db_instance_endpoint
      security_group  = module.postgresql.security_group_id
      arn            = module.postgresql.db_instance_arn
      instance_class  = var.instance_class
      engine_version  = var.engine_version
      multi_az       = var.multi_az
    }
    timescaledb = {
      endpoint        = module.timescaledb.db_instance_endpoint
      security_group  = module.timescaledb.security_group_id
      arn            = module.timescaledb.db_instance_arn
      instance_class  = var.instance_class
      engine_version  = var.engine_version
      multi_az       = var.multi_az
    }
  }
  sensitive = false
}

# Monitoring Information Output
output "monitoring_info" {
  description = "Information about database monitoring configuration"
  value = {
    enhanced_monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
    monitoring_interval         = var.monitoring_interval
    performance_insights_retention = var.performance_insights_retention_period
  }
}

# Backup Configuration Output
output "backup_info" {
  description = "Information about database backup configuration"
  value = {
    postgresql_backup_window  = module.postgresql.backup_window
    timescaledb_backup_window = module.timescaledb.backup_window
    retention_period         = var.backup_retention_period
  }
}

# Security Configuration Output
output "security_info" {
  description = "Security-related configuration information for databases"
  value = {
    kms_key_arn = aws_kms_key.rds.arn
    storage_encrypted = var.storage_encrypted
    deletion_protection = var.deletion_protection
  }
}