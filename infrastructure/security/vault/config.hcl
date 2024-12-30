# Vault Server Configuration v1.13+
# Purpose: Production configuration for Bookman AI platform secret management
# Security: TLS 1.2+, AWS KMS auto-unseal, audit logging

# Storage configuration using Raft for high availability
storage "raft" {
    path = "/vault/data"
    node_id = "vault_1"
    
    retry_join {
        leader_api_addr = "https://vault-0.vault-internal:8200"
        leader_ca_cert_file = "/vault/tls/ca.crt"
        leader_client_cert_file = "/vault/tls/tls.crt"
        leader_client_key_file = "/vault/tls/tls.key"
        retry_interval = "10s"
        max_retries = 5
    }
    
    performance_multiplier = 1
    snapshot_interval = "1h"
    snapshot_threshold = 8192
}

# API Listener configuration with TLS
listener "tcp" {
    address = "0.0.0.0:8200"
    cluster_address = "0.0.0.0:8201"
    tls_disable = false
    
    # TLS Configuration
    tls_cert_file = "/vault/tls/tls.crt"
    tls_key_file = "/vault/tls/tls.key"
    tls_min_version = "tls12"
    tls_cipher_suites = [
        "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
        "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
    ]
    tls_prefer_server_cipher_suites = true
    
    # Security headers
    x_forwarded_for_authorized_addrs = "10.0.0.0/8"
}

# AWS KMS Auto-unseal configuration
seal "awskms" {
    region = "us-west-2"
    kms_key_id = "alias/vault-unseal-key"
    endpoint = "https://kms.us-west-2.amazonaws.com"
    key_rotation_period = "30d"
    disable_renewal = false
}

# API Configuration
api_addr = "https://vault.bookman.ai:8200"
cluster_addr = "https://vault.bookman.ai:8201"

# Lease configuration
max_lease_ttl = "768h"          # 32 days
default_lease_ttl = "168h"      # 7 days

# Telemetry configuration for monitoring
telemetry {
    prometheus_retention_time = "30s"
    disable_hostname = true
    enable_hostname_label = false
    usage_gauge_period = "10m"
    maximum_gauge_cardinality = 500
    lease_metrics_epsilon = "1h"
}

# Audit logging configuration
audit {
    device "file" {
        path = "/vault/logs/audit.log"
        log_raw = false
        mode = "0600"
        format = "json"
        rotation_period = "24h"
        rotation_max_files = 30
    }
    
    device "syslog" {
        tag = "vault-audit"
        facility = "AUTH"
        log_raw = false
    }
}

# UI Configuration
ui = true

# Additional security configurations
disable_mlock = false
cluster_name = "bookman-vault-cluster"
log_level = "warn"

# Plugin configuration
plugin_directory = "/vault/plugins"

# Cluster configuration
cluster {
    disable_clustering = false
    name = "bookman-vault"
}

# Service registration for discovery
service_registration "kubernetes" {
    namespace = "vault"
    pod_name = "${POD_NAME}"
}

# Cache configuration
cache {
    use_auth_auth_token = true
}

# Entropy augmentation
entropy {
    mode = "augmentation"
}