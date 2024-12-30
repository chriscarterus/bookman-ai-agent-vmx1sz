# AWS Provider version constraint is inherited from vpc.tf

# Redis Auth Token - Secure string for Redis authentication
variable "redis_auth_token" {
  description = "Auth token for Redis authentication (must be at least 16 chars)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.redis_auth_token) >= 16
    error_message = "Redis auth token must be at least 16 characters long"
  }
}

# ElastiCache Security Group
resource "aws_security_group" "redis" {
  name_prefix = "bookman-${var.environment}-redis-"
  description = "Security group for Bookman AI Redis clusters"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Redis from private subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [for subnet in aws_subnet.private : subnet.cidr_block]
  }

  tags = {
    Name          = "bookman-${var.environment}-redis-sg"
    Environment   = var.environment
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    SecurityLevel = "High"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name        = "bookman-${var.environment}-redis-subnet"
  description = "Subnet group for Bookman AI Redis clusters"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name          = "bookman-${var.environment}-redis-subnet"
    Environment   = var.environment
    Project       = "BookmanAI"
    ManagedBy     = "Terraform"
    SecurityLevel = "High"
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7.0"
  name        = "bookman-${var.environment}-redis-params"
  description = "Optimized parameter group for Bookman AI Redis clusters"

  # Memory Management
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"  # Evict keys with expiration set using LRU
  }

  # Performance Optimization
  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  # Connection Management
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  # Persistence and Durability
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"  # Expired events notification
  }

  tags = {
    Name        = "bookman-${var.environment}-redis-params"
    Environment = var.environment
    Project     = "BookmanAI"
    ManagedBy   = "Terraform"
  }
}

# ElastiCache Replication Group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "bookman-${var.environment}-redis"
  description         = "High-availability Redis cluster for Bookman AI platform"
  
  # Instance Configuration
  node_type                  = "cache.r6g.large"
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  
  # High Availability Settings
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters        = 2
  
  # Security Settings
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  # Engine Configuration
  engine                    = "redis"
  engine_version           = "7.0"
  
  # Maintenance Settings
  maintenance_window        = "sun:05:00-sun:07:00"
  snapshot_window          = "03:00-05:00"
  snapshot_retention_limit = 7
  auto_minor_version_upgrade = true
  apply_immediately        = false

  tags = {
    Name             = "bookman-${var.environment}-redis"
    Environment      = var.environment
    Project          = "BookmanAI"
    ManagedBy        = "Terraform"
    SecurityLevel    = "High"
    CostCenter       = "Infrastructure"
    BackupRetention  = "7days"
    HighAvailability = "Enabled"
  }
}

# Outputs for application configuration
output "redis_endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint address"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port number"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_connection_info" {
  description = "Redis connection information"
  value = {
    primary_endpoint    = aws_elasticache_replication_group.redis.primary_endpoint_address
    reader_endpoint     = aws_elasticache_replication_group.redis.reader_endpoint_address
    port               = aws_elasticache_replication_group.redis.port
    parameter_group    = aws_elasticache_replication_group.redis.parameter_group_name
    engine_version     = aws_elasticache_replication_group.redis.engine_version
  }
  sensitive = true
}