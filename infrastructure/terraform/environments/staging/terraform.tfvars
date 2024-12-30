# AWS Region Configuration
aws_region = "us-west-2"
environment = "staging"

# Networking Configuration
vpc_cidr = "10.1.0.0/16"
enable_multi_az = true

# EKS Configuration
eks_cluster_version = "1.27"
eks_node_instance_types = ["t3.xlarge"]
eks_min_nodes = 3
eks_max_nodes = 10
eks_desired_nodes = 3

# RDS Configuration
rds_instance_class = "db.r6g.xlarge"
rds_engine_version = "15.3"
rds_storage_type = "gp3"
rds_allocated_storage = 100
rds_max_allocated_storage = 500
rds_backup_retention_days = 35
rds_multi_az = true
rds_deletion_protection = true

# ElastiCache Configuration
elasticache_node_type = "cache.r6g.large"
elasticache_num_cache_nodes = 2
elasticache_engine_version = "7.0"
elasticache_automatic_failover = true
elasticache_multi_az = true

# Security Configuration
enable_encryption = true
enable_cloudtrail = true
enable_config = true
enable_guardduty = true
enable_security_hub = true
enable_waf = true
ssl_certificate_arn = "arn:aws:acm:us-west-2:*:certificate/*"

# Monitoring Configuration
enable_enhanced_monitoring = true
monitoring_interval = 30
log_retention_days = 90
enable_performance_insights = true
performance_insights_retention = 7

# Backup Configuration
backup_retention_days = 35
enable_cross_region_backup = true
backup_window = "03:00-04:00"
maintenance_window = "Mon:04:00-Mon:05:00"

# Cost Management
enable_cost_allocation_tags = true
enable_budget_alerts = true
monthly_budget_limit = 10000

# Resource Tags
tags = {
  Environment     = "staging"
  Project         = "BookmanAI"
  ManagedBy       = "Terraform"
  SecurityLevel   = "high"
  BackupPolicy    = "standard"
  CostCenter      = "staging-ops"
  DataClass       = "confidential"
  ComplianceScope = "pci-dss"
  MaintenanceDay  = "monday"
  Owner           = "platform-team"
}

# Auto Scaling Configuration
enable_autoscaling = true
autoscaling_target_cpu = 70
autoscaling_target_memory = 80

# DNS Configuration
route53_zone_name = "staging.bookmanai.com"
enable_private_endpoints = true

# S3 Configuration
enable_s3_versioning = true
enable_s3_encryption = true
s3_lifecycle_rules_enabled = true
s3_replication_enabled = true

# Network Security
enable_vpc_flow_logs = true
enable_network_firewall = true
allowed_ip_ranges = ["10.0.0.0/8"]
enable_transit_gateway = true

# IAM Configuration
enable_iam_roles = true
enable_service_accounts = true
enable_pod_identity = true
enable_irsa = true

# Compliance and Audit
enable_audit_logs = true
enable_access_logging = true
enable_cloudwatch_alarms = true
compliance_mode = "strict"