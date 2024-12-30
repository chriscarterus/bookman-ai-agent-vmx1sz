use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use dotenv::dotenv;
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, Secret};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use url::Url;

// Thread-safe global configuration
pub static CONFIG: Lazy<Config> = Lazy::new(|| {
    load_config().expect("Failed to load configuration")
});

// Default constants with security thresholds
const DEFAULT_FRAUD_DETECTION_THRESHOLD: f64 = 0.85;
const DEFAULT_AUDIT_TIMEOUT_SECONDS: u32 = 300;
const DEFAULT_MAX_CONCURRENT_SCANS: u32 = 50;
const DEFAULT_ALERT_RETENTION_DAYS: u32 = 90;
const MIN_DETECTION_THRESHOLD: f64 = 0.5;
const MAX_CONTRACT_SIZE_BYTES: usize = 10_485_760; // 10MB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_url: Secret<String>,
    pub redis_url: Secret<String>,
    pub blockchain_nodes: Vec<BlockchainNodeConfig>,
    pub fraud_detection: FraudDetectionConfig,
    pub smart_contract_audit: SmartContractAuditConfig,
    pub alert_settings: AlertConfig,
    pub logging: LogConfig,
    pub metrics: MetricsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainNodeConfig {
    pub url: Secret<String>,
    pub chain_id: u64,
    pub retry_policy: RetryConfig,
    pub timeout_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudDetectionConfig {
    pub model_path: PathBuf,
    pub detection_threshold: f64,
    pub batch_size: usize,
    pub update_interval_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartContractAuditConfig {
    pub timeout_seconds: u32,
    pub max_concurrent_scans: u32,
    pub max_contract_size: usize,
    pub solidity_version_pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub retention_days: u32,
    pub severity_thresholds: SeverityThresholds,
    pub notification_channels: Vec<NotificationChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeverityThresholds {
    pub high: f64,
    pub medium: f64,
    pub low: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationChannel {
    pub channel_type: String,
    pub endpoint: Secret<String>,
    pub min_severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    pub level: String,
    pub format: String,
    pub output_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub port: u16,
    pub path: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Invalid URL format: {0}")]
    InvalidUrl(String),
    #[error("Invalid threshold value: {0}")]
    InvalidThreshold(String),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
    #[error("Invalid configuration value: {0}")]
    InvalidValue(String),
}

impl Config {
    pub fn new() -> Result<Self, ConfigError> {
        load_config()
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate database URL
        if let Err(_) = Url::parse(self.database_url.expose_secret()) {
            return Err(ValidationError::InvalidUrl("Invalid database URL".into()));
        }

        // Validate Redis URL
        if let Err(_) = Url::parse(self.redis_url.expose_secret()) {
            return Err(ValidationError::InvalidUrl("Invalid Redis URL".into()));
        }

        // Validate blockchain nodes
        for node in &self.blockchain_nodes {
            if let Err(_) = Url::parse(node.url.expose_secret()) {
                return Err(ValidationError::InvalidUrl(format!("Invalid blockchain node URL for chain {}", node.chain_id)));
            }
        }

        // Validate fraud detection settings
        if self.fraud_detection.detection_threshold < MIN_DETECTION_THRESHOLD {
            return Err(ValidationError::InvalidThreshold(
                "Fraud detection threshold too low".into()
            ));
        }

        // Validate smart contract audit settings
        if self.smart_contract_audit.max_contract_size > MAX_CONTRACT_SIZE_BYTES {
            return Err(ValidationError::InvalidValue(
                "Contract size limit exceeds maximum".into()
            ));
        }

        // Validate alert settings
        if self.alert_settings.retention_days == 0 {
            return Err(ValidationError::InvalidValue(
                "Alert retention days must be greater than 0".into()
            ));
        }

        Ok(())
    }
}

pub fn load_config() -> Result<Config, ConfigError> {
    // Load .env file if present
    dotenv().ok();

    let environment = std::env::var("RUST_ENV").unwrap_or_else(|_| "development".into());

    let config = ConfigBuilder::builder()
        // Set defaults
        .set_default("fraud_detection.detection_threshold", DEFAULT_FRAUD_DETECTION_THRESHOLD)?
        .set_default("smart_contract_audit.timeout_seconds", DEFAULT_AUDIT_TIMEOUT_SECONDS)?
        .set_default("smart_contract_audit.max_concurrent_scans", DEFAULT_MAX_CONCURRENT_SCANS)?
        .set_default("alert_settings.retention_days", DEFAULT_ALERT_RETENTION_DAYS)?
        
        // Load configuration file based on environment
        .add_source(File::with_name(&format!("config/{}", environment)).required(false))
        
        // Override with environment variables
        .add_source(Environment::with_prefix("SECURITY_SERVICE").separator("__"))
        .build()?;

    let config: Config = config.try_deserialize()?;
    
    // Validate the configuration
    config.validate().map_err(|e| ConfigError::Message(e.to_string()))?;

    Ok(config)
}

pub fn get_config() -> &'static Config {
    &CONFIG
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_config_validation() {
        let valid_config = Config {
            database_url: Secret::new("postgresql://localhost:5432/security".into()),
            redis_url: Secret::new("redis://localhost:6379".into()),
            blockchain_nodes: vec![BlockchainNodeConfig {
                url: Secret::new("https://eth-mainnet.alchemyapi.io/v2/key".into()),
                chain_id: 1,
                retry_policy: RetryConfig {
                    max_attempts: 3,
                    base_delay_ms: 1000,
                    max_delay_ms: 5000,
                },
                timeout_seconds: 30,
            }],
            fraud_detection: FraudDetectionConfig {
                model_path: PathBuf::from_str("/models/fraud_detection").unwrap(),
                detection_threshold: 0.85,
                batch_size: 100,
                update_interval_seconds: 3600,
            },
            smart_contract_audit: SmartContractAuditConfig {
                timeout_seconds: 300,
                max_concurrent_scans: 50,
                max_contract_size: 1_000_000,
                solidity_version_pattern: "^0.8.".into(),
            },
            alert_settings: AlertConfig {
                retention_days: 90,
                severity_thresholds: SeverityThresholds {
                    high: 0.9,
                    medium: 0.7,
                    low: 0.5,
                },
                notification_channels: vec![],
            },
            logging: LogConfig {
                level: "info".into(),
                format: "json".into(),
                output_path: PathBuf::from_str("/var/log/security-service").unwrap(),
            },
            metrics: MetricsConfig {
                enabled: true,
                port: 9090,
                path: "/metrics".into(),
            },
        };

        assert!(valid_config.validate().is_ok());
    }

    #[test]
    fn test_invalid_urls() {
        let mut config = Config {
            database_url: Secret::new("invalid-url".into()),
            // ... other fields initialized with valid values
            redis_url: Secret::new("redis://localhost:6379".into()),
            blockchain_nodes: vec![],
            fraud_detection: FraudDetectionConfig {
                model_path: PathBuf::new(),
                detection_threshold: 0.85,
                batch_size: 100,
                update_interval_seconds: 3600,
            },
            smart_contract_audit: SmartContractAuditConfig {
                timeout_seconds: 300,
                max_concurrent_scans: 50,
                max_contract_size: 1_000_000,
                solidity_version_pattern: "^0.8.".into(),
            },
            alert_settings: AlertConfig {
                retention_days: 90,
                severity_thresholds: SeverityThresholds {
                    high: 0.9,
                    medium: 0.7,
                    low: 0.5,
                },
                notification_channels: vec![],
            },
            logging: LogConfig {
                level: "info".into(),
                format: "json".into(),
                output_path: PathBuf::new(),
            },
            metrics: MetricsConfig {
                enabled: true,
                port: 9090,
                path: "/metrics".into(),
            },
        };

        assert!(matches!(
            config.validate(),
            Err(ValidationError::InvalidUrl(_))
        ));
    }
}