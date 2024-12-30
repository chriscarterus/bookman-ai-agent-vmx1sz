use anyhow::Result;
use metrics::{counter, gauge};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::signal;
use tonic::transport::Server;
use tracing::{error, info, warn};

use crate::{
    config::{Config, get_config},
    models::alert::Alert,
    services::{
        fraud_detection::FraudDetectionService,
        smart_contract_audit::SmartContractAuditor,
    },
};

// Version comments for external dependencies
// tokio = "1.28"
// tonic = "0.9"
// tracing = "0.1"
// metrics = "0.20"
// anyhow = "1.0"

// Global constants
const DEFAULT_PORT: u16 = 50051;
const SERVICE_NAME: &str = "security-service";
const METRICS_PREFIX: &str = "security_service";
const MAX_CONCURRENT_AUDITS: usize = 100;

/// Main security service implementation
#[derive(Debug)]
pub struct SecurityServer {
    fraud_service: Arc<FraudDetectionService>,
    audit_service: Arc<SmartContractAuditor>,
    alert_manager: Arc<Alert>,
}

impl SecurityServer {
    /// Creates a new SecurityServer instance with enhanced validation
    pub async fn new(config: &Config) -> Result<Self> {
        info!("Initializing SecurityServer with configuration");

        // Initialize blockchain client
        let blockchain_client = utils::blockchain::connect_node(
            config.blockchain_nodes[0].url.expose_secret().clone(),
            config.blockchain_nodes[0].chain_id,
            config.blockchain_nodes[0].retry_policy.clone(),
        ).await?;

        // Initialize fraud detection service
        let fraud_service = FraudDetectionService::new(
            blockchain_client.clone(),
            config.fraud_detection.clone(),
            config.metrics.clone(),
        ).await?;

        // Initialize smart contract auditor
        let audit_service = SmartContractAuditor::new(
            blockchain_client,
            config.smart_contract_audit.clone(),
        );

        // Initialize alert manager
        let alert_manager = Alert::new(
            "high".to_string(),
            "Security Service Alerts".to_string(),
            "system".to_string(),
        )?;

        Ok(Self {
            fraud_service: Arc::new(fraud_service),
            audit_service: Arc::new(audit_service),
            alert_manager: Arc::new(alert_manager),
        })
    }

    /// Starts the security service with enhanced monitoring
    pub async fn serve(self, addr: SocketAddr) -> Result<()> {
        info!("Starting security service on {}", addr);

        // Initialize metrics
        self.init_metrics()?;

        // Create gRPC service
        let security_service = SecurityServiceImpl {
            fraud_service: Arc::clone(&self.fraud_service),
            audit_service: Arc::clone(&self.audit_service),
            alert_manager: Arc::clone(&self.alert_manager),
        };

        // Configure and start server
        let server = Server::builder()
            .add_service(SecurityServiceServer::new(security_service))
            .serve_with_shutdown(addr, Self::shutdown_signal());

        // Record server metrics
        gauge!("security_service.start_time_seconds", chrono::Utc::now().timestamp() as f64);
        counter!("security_service.starts_total", 1);

        // Start server with graceful shutdown
        match server.await {
            Ok(_) => {
                info!("Security service stopped gracefully");
                Ok(())
            }
            Err(e) => {
                error!("Security service error: {}", e);
                counter!("security_service.errors_total", 1);
                Err(e.into())
            }
        }
    }

    // Initialize service metrics
    fn init_metrics(&self) -> Result<()> {
        metrics::register_counter!("security_service.fraud_detections_total");
        metrics::register_counter!("security_service.contract_audits_total");
        metrics::register_counter!("security_service.alerts_generated_total");
        metrics::register_gauge!("security_service.active_audits");
        metrics::register_histogram!("security_service.audit_duration_seconds");
        Ok(())
    }

    // Graceful shutdown handler
    async fn shutdown_signal() {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => info!("Received Ctrl+C signal"),
            _ = terminate => info!("Received terminate signal"),
        }

        info!("Initiating graceful shutdown");
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("Starting {} v{}", SERVICE_NAME, env!("CARGO_PKG_VERSION"));

    // Load configuration
    let config = get_config();

    // Create server instance
    let server = SecurityServer::new(config).await?;

    // Determine server address
    let addr = SocketAddr::from(([0, 0, 0, 0], config.metrics.port.unwrap_or(DEFAULT_PORT)));

    // Start server
    match server.serve(addr).await {
        Ok(_) => {
            info!("Security service shutdown complete");
            Ok(())
        }
        Err(e) => {
            error!("Security service failed: {}", e);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};

    #[tokio::test]
    async fn test_server_initialization() {
        let config = get_config();
        let server = SecurityServer::new(config).await;
        assert!(server.is_ok());
    }

    #[tokio::test]
    async fn test_metrics_initialization() {
        let config = get_config();
        let server = SecurityServer::new(config).await.unwrap();
        assert!(server.init_metrics().is_ok());
    }

    #[tokio::test]
    async fn test_server_shutdown() {
        let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0);
        let config = get_config();
        let server = SecurityServer::new(config).await.unwrap();
        
        let server_handle = tokio::spawn(async move {
            server.serve(addr).await
        });

        // Simulate shutdown after 1 second
        tokio::time::sleep(Duration::from_secs(1)).await;
        assert!(server_handle.abort().is_ok());
    }
}