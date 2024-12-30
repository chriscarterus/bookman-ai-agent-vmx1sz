# HashiCorp Vault Service Policies for Bookman AI Platform
# Version: 1.13+
# Purpose: Define granular access control policies for microservices

# Global policy defaults
path "sys/*" {
    capabilities = ["deny"]
}

path "secret/*" {
    capabilities = ["deny"]
}

# Authentication Service Policy
# Handles user authentication and token management
path "auth/jwt/*" {
    capabilities = ["read", "create", "update"]
    required_parameters = ["jwt_issuer", "jwt_algorithms"]
    allowed_parameters = {
        "jwt_algorithms" = ["RS256", "ES256"]
        "jwt_issuer" = ["bookman-auth-service"]
    }
    max_ttl = "168h"
    audit_logging = true
}

path "secret/data/auth-service/*" {
    capabilities = ["read", "create", "update", "delete"]
    required_parameters = ["jwt_secret", "oauth_config", "encryption_key"]
    denied_parameters = {
        "jwt_secret" = ["null", ""]
    }
    max_ttl = "168h"
    min_wrapping_ttl = "1h"
    max_wrapping_ttl = "24h"
}

# Market Analysis Service Policy
# Handles market data processing and analysis
path "secret/data/market-analysis/*" {
    capabilities = ["read"]
    required_parameters = ["api_keys", "db_credentials", "rate_limits"]
    allowed_parameters = {
        "rate_limits" = ["standard", "premium"]
    }
    max_ttl = "24h"
    audit_logging = true
}

# Education Service Policy
# Manages learning content and progress tracking
path "secret/data/education-service/*" {
    capabilities = ["read"]
    required_parameters = ["storage_keys", "ai_api_key", "content_encryption_key"]
    denied_parameters = {
        "content_encryption_key" = ["null", ""]
    }
    max_ttl = "168h"
    audit_logging = true
}

# Portfolio Service Policy
# Handles user portfolio management
path "secret/data/portfolio-service/*" {
    capabilities = ["read"]
    required_parameters = ["db_credentials", "encryption_key", "backup_key"]
    allowed_parameters = {
        "db_credentials" = ["read", "write"]
    }
    max_ttl = "72h"
    min_wrapping_ttl = "1h"
    max_wrapping_ttl = "12h"
}

# Security Service Policy
# Manages security alerts and fraud detection
path "secret/data/security-service/*" {
    capabilities = ["read", "create"]
    required_parameters = ["audit_api_key", "blockchain_api_key", "alert_encryption_key"]
    denied_parameters = {
        "alert_encryption_key" = ["null", ""]
    }
    max_ttl = "24h"
    audit_logging = true
}

# Community Service Policy
# Handles user interactions and social features
path "secret/data/community-service/*" {
    capabilities = ["read"]
    required_parameters = ["db_credentials", "notification_key", "rate_limit_key"]
    allowed_parameters = {
        "rate_limit_key" = ["basic", "enhanced"]
    }
    max_ttl = "168h"
    audit_logging = true
}

# Rotation and Lifecycle Management
path "sys/rotate/*" {
    capabilities = ["update"]
    allowed_parameters = {
        "auto_rotate" = ["true"]
        "rotation_period" = ["168h"]
    }
    max_ttl = "768h"
}

# Audit Log Configuration
path "sys/audit/*" {
    capabilities = ["read"]
    allowed_parameters = {
        "log_sensitive_data" = ["false"]
        "log_request_parameters" = ["true"]
    }
}

# Service Identity Validation
path "auth/token/lookup-self" {
    capabilities = ["read"]
}

# Cross-Service Access Control
path "sys/internal/ui/mounts/*" {
    capabilities = ["read"]
    denied_parameters = {
        "cross_service_access" = ["true"]
    }
}

# Namespace Binding
path "sys/namespaces/*" {
    capabilities = ["deny"]
    denied_parameters = {
        "namespace_binding" = ["false"]
    }
}

# Default Deny All Other Paths
path "+/*" {
    capabilities = ["deny"]
}