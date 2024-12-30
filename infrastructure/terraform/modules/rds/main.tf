# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true

  tags = merge(var.tags, {
    Name = "${var.identifier_prefix}-rds-encryption-key"
  })
}

# Security group for PostgreSQL
resource "aws_security_group" "postgresql" {
  name_prefix = "${var.identifier_prefix}-postgresql-"
  description = "Security group for PostgreSQL RDS instance"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.vpc_security_group_ids
  }

  tags = merge(var.tags, {
    Name = "${var.identifier_prefix}-postgresql-sg"
  })
}

# Security group for TimescaleDB
resource "aws_security_group" "timescaledb" {
  name_prefix = "${var.identifier_prefix}-timescaledb-"
  description = "Security group for TimescaleDB RDS instance"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.vpc_security_group_ids
  }

  tags = merge(var.tags, {
    Name = "${var.identifier_prefix}-timescaledb-sg"
  })
}

# Enhanced monitoring role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name_prefix = "${var.identifier_prefix}-rds-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]

  tags = var.tags
}

# PostgreSQL RDS instance
module "postgresql" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "${var.identifier_prefix}-postgresql"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = var.instance_class
  allocated_storage    = 100
  max_allocated_storage = 1000

  # Database configuration
  db_name  = "bookman"
  username = "bookman_admin"
  port     = 5432

  # Network configuration
  multi_az               = true
  subnet_ids             = var.subnet_ids
  vpc_security_group_ids = [aws_security_group.postgresql.id]

  # Maintenance and backup
  maintenance_window          = "Mon:03:00-Mon:04:00"
  backup_window              = "02:00-03:00"
  backup_retention_period    = var.backup_retention_period
  deletion_protection        = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.identifier_prefix}-postgresql-final"

  # Monitoring and performance
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_period
  create_monitoring_role               = false

  # Encryption
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  # Parameters
  parameters = [
    {
      name  = "max_connections"
      value = "500"
    },
    {
      name  = "shared_buffers"
      value = "{DBInstanceClassMemory/4}"
    }
  ]

  tags = merge(var.tags, {
    Database = "PostgreSQL"
  })
}

# TimescaleDB RDS instance
module "timescaledb" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "${var.identifier_prefix}-timescaledb"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = var.instance_class
  allocated_storage    = 200
  max_allocated_storage = 2000

  # Database configuration
  db_name  = "bookman_market"
  username = "bookman_market_admin"
  port     = 5432

  # Network configuration
  multi_az               = true
  subnet_ids             = var.subnet_ids
  vpc_security_group_ids = [aws_security_group.timescaledb.id]

  # Maintenance and backup
  maintenance_window          = "Mon:04:00-Mon:05:00"
  backup_window              = "03:00-04:00"
  backup_retention_period    = var.backup_retention_period
  deletion_protection        = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.identifier_prefix}-timescaledb-final"

  # Monitoring and performance
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_period
  create_monitoring_role               = false

  # Encryption
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  # TimescaleDB specific parameters
  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "timescaledb"
    },
    {
      name  = "max_connections"
      value = "500"
    },
    {
      name  = "timescaledb.max_background_workers"
      value = "16"
    },
    {
      name  = "shared_buffers"
      value = "{DBInstanceClassMemory/4}"
    }
  ]

  tags = merge(var.tags, {
    Database = "TimescaleDB"
  })
}

# Outputs
output "postgresql_endpoint" {
  description = "PostgreSQL instance endpoint"
  value = {
    endpoint = module.postgresql.db_instance_endpoint
    port     = module.postgresql.db_instance_port
  }
}

output "timescaledb_endpoint" {
  description = "TimescaleDB instance endpoint"
  value = {
    endpoint = module.timescaledb.db_instance_endpoint
    port     = module.timescaledb.db_instance_port
  }
}

output "security_group_ids" {
  description = "Security group IDs for database access"
  value = {
    postgresql_sg_id  = aws_security_group.postgresql.id
    timescaledb_sg_id = aws_security_group.timescaledb.id
  }
}