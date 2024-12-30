# RDS Infrastructure for Bookman AI Platform
# Version: 6.0.0 of terraform-aws-modules/rds/aws

# Local variables for configuration
locals {
  private_subnet_ids = data.aws_subnet_ids.private.ids
  common_tags = merge(var.tags, {
    Service = "RDS"
    Component = "Database"
  })
}

# Data source for VPC and subnet information
data "aws_vpc" "main" {
  id = data.terraform_remote_state.vpc.outputs.vpc_id
}

data "aws_subnet_ids" "private" {
  vpc_id = data.aws_vpc.main.id
  tags = {
    Type = "private"
  }
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "bookman-${var.environment}-rds-monitoring"
  
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

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Security group for RDS instances
resource "aws_security_group" "rds" {
  name        = "bookman-${var.environment}-rds-sg"
  description = "Security group for Bookman RDS instances"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "Allow PostgreSQL access from EKS cluster"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "bookman-${var.environment}-rds-sg"
  })
}

# Main PostgreSQL instance for application data
module "postgresql" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "bookman-${var.environment}-postgresql"

  engine               = "postgres"
  engine_version       = "15.3"
  family              = "postgres15"
  major_engine_version = "15"
  instance_class       = var.rds_instance_class

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = var.enable_encryption

  db_name  = "bookman"
  username = "bookman_admin"
  port     = 5432

  multi_az               = var.enable_multi_az
  subnet_ids             = local.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds.id]

  maintenance_window          = "Mon:00:00-Mon:03:00"
  backup_window              = "03:00-06:00"
  backup_retention_period    = var.backup_retention_days
  deletion_protection        = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "bookman-${var.environment}-postgresql-final-${formatdate("YYYY-MM-DD", timestamp())}"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                  = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  parameters = [
    {
      name  = "max_connections"
      value = "1000"
    },
    {
      name  = "shared_buffers"
      value = "8GB"
    }
  ]

  tags = merge(local.common_tags, {
    Name = "bookman-${var.environment}-postgresql"
  })
}

# TimescaleDB instance for market data
module "timescaledb" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "bookman-${var.environment}-timescaledb"

  engine               = "postgres"
  engine_version       = "15.3"
  family              = "postgres15"
  major_engine_version = "15"
  instance_class       = var.rds_instance_class

  allocated_storage     = 200
  max_allocated_storage = 2000
  storage_encrypted     = var.enable_encryption

  db_name  = "bookman_market"
  username = "bookman_market_admin"
  port     = 5432

  multi_az               = var.enable_multi_az
  subnet_ids             = local.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds.id]

  maintenance_window          = "Mon:00:00-Mon:03:00"
  backup_window              = "03:00-06:00"
  backup_retention_period    = var.backup_retention_days
  deletion_protection        = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "bookman-${var.environment}-timescaledb-final-${formatdate("YYYY-MM-DD", timestamp())}"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                  = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "timescaledb"
    },
    {
      name  = "max_connections"
      value = "1000"
    },
    {
      name  = "shared_buffers"
      value = "16GB"
    },
    {
      name  = "timescaledb.max_background_workers"
      value = "16"
    }
  ]

  tags = merge(local.common_tags, {
    Name = "bookman-${var.environment}-timescaledb"
  })
}

# Outputs
output "postgresql_endpoint" {
  description = "PostgreSQL RDS endpoint for application connection"
  value       = module.postgresql.db_instance_endpoint
}

output "timescaledb_endpoint" {
  description = "TimescaleDB RDS endpoint for market data connection"
  value       = module.timescaledb.db_instance_endpoint
}

output "security_group_id" {
  description = "Security group ID for RDS instances"
  value       = aws_security_group.rds.id
}