use criterion::{criterion_group, criterion_main, Criterion};
use mockall::predicate::*;
use serde_json::json;
use std::{collections::HashMap, sync::Arc, time::Duration};
use test_case::test_case;
use tokio::sync::RwLock;

// Import version comments for external dependencies
// tokio = "1.28"
// mockall = "0.11"
// test-case = "3.1"
// criterion = "0.4"

use crate::{
    models::alert::Alert,
    services::fraud_detection::FraudDetectionService,
    utils::blockchain::{BlockchainClient, SecurityError, SecuritySeverity},
};

// Test constants
const MOCK_TRANSACTION_DATA: &str = r#"{
    "hash": "0x123",
    "from": "0xabc",
    "to": "0xdef",
    "value": "1.5",
    "pattern": "high_risk"
}"#;

const TEST_USER_ID: &str = "test-user-123";
const ML_MODEL_ACCURACY_THRESHOLD: f64 = 0.999; // 99.9% accuracy requirement
const TEST_TRANSACTION_PATTERNS: [&str; 4] = ["wash_trading", "layering", "spoofing", "front_running"];

/// Mock blockchain client for testing
#[derive(Debug)]
struct MockBlockchainClient {
    mock_transactions: Arc<RwLock<Vec<String>>>,
    fraud_patterns: HashMap<String, String>,
    metrics: MetricsCollector,
}

impl MockBlockchainClient {
    fn new() -> Self {
        Self {
            mock_transactions: Arc::new(RwLock::new(Vec::new())),
            fraud_patterns: HashMap::new(),
            metrics: MetricsCollector::default(),
        }
    }

    async fn add_mock_transaction(&self, transaction: String) {
        let mut transactions = self.mock_transactions.write().await;
        transactions.push(transaction);
    }
}

/// Helper function to setup test service instance
async fn setup_test_service(ml_config: Option<ModelConfig>) -> Result<FraudDetectionService, SecurityError> {
    let blockchain_client = Arc::new(MockBlockchainClient::new());
    let alert_manager = Arc::new(Alert::new(
        "high".to_string(),
        "Test Alert Manager".to_string(),
        TEST_USER_ID.to_string(),
    )?);

    FraudDetectionService::new(
        blockchain_client,
        ml_config.unwrap_or_default(),
        MetricsConfig::default(),
    ).await
}

/// Test ML model accuracy across different fraud patterns
#[tokio::test]
async fn test_ml_model_accuracy() -> Result<(), SecurityError> {
    let service = setup_test_service(None).await?;
    let mut total_correct = 0;
    let mut total_cases = 0;

    for pattern in TEST_TRANSACTION_PATTERNS.iter() {
        // Generate test cases for each pattern
        let test_cases = generate_test_cases(pattern, 1000)?;
        
        for case in test_cases {
            let result = service.detect_fraud(case.clone()).await?;
            
            if result.is_fraud == case.expected_fraud {
                total_correct += 1;
            }
            total_cases += 1;
        }
    }

    let accuracy = total_correct as f64 / total_cases as f64;
    assert!(
        accuracy >= ML_MODEL_ACCURACY_THRESHOLD,
        "Model accuracy {:.4} below required threshold {:.4}",
        accuracy,
        ML_MODEL_ACCURACY_THRESHOLD
    );

    Ok(())
}

/// Test fraud detection with various transaction patterns
#[test_case("wash_trading", true ; "when wash trading pattern detected")]
#[test_case("normal_trading", false ; "when normal trading pattern")]
#[test_case("layering", true ; "when layering pattern detected")]
#[test_case("spoofing", true ; "when spoofing pattern detected")]
async fn test_fraud_detection_patterns(
    pattern: &str,
    expected_fraud: bool,
) -> Result<(), SecurityError> {
    let service = setup_test_service(None).await?;
    let test_transaction = json!({
        "pattern": pattern,
        "timestamp": chrono::Utc::now(),
        "amount": "1.5",
        "user_id": TEST_USER_ID,
    });

    let result = service.detect_fraud(test_transaction).await?;
    assert_eq!(result.is_fraud, expected_fraud);
    
    if expected_fraud {
        assert!(result.confidence >= 0.95);
        assert!(!result.patterns_detected.is_empty());
    }

    Ok(())
}

/// Test alert generation for fraudulent transactions
#[tokio::test]
async fn test_alert_generation() -> Result<(), SecurityError> {
    let service = setup_test_service(None).await?;
    let test_transaction = serde_json::from_str(MOCK_TRANSACTION_DATA)?;

    // Trigger fraud detection
    let result = service.detect_fraud(test_transaction).await?;
    assert!(result.is_fraud);

    // Verify alert was generated
    let alerts = service.get_alerts(TEST_USER_ID).await?;
    assert!(!alerts.is_empty());

    let alert = alerts.first().unwrap();
    assert_eq!(alert.severity, "high");
    assert!(alert.description.contains(&result.transaction_id));

    Ok(())
}

/// Test blockchain monitoring functionality
#[tokio::test]
async fn test_blockchain_monitoring() -> Result<(), SecurityError> {
    let service = setup_test_service(None).await?;
    let mock_client = Arc::new(MockBlockchainClient::new());

    // Add mock transactions
    for pattern in TEST_TRANSACTION_PATTERNS.iter() {
        mock_client.add_mock_transaction(json!({
            "pattern": pattern,
            "timestamp": chrono::Utc::now(),
        }).to_string()).await;
    }

    // Start monitoring
    let monitoring_handle = tokio::spawn(async move {
        service.monitor_blockchain().await
    });

    // Wait for monitoring to process transactions
    tokio::time::sleep(Duration::from_secs(1)).await;

    // Verify monitoring results
    let metrics = service.get_monitoring_metrics().await?;
    assert!(metrics.transactions_processed > 0);
    assert!(metrics.fraud_detected > 0);

    monitoring_handle.abort();
    Ok(())
}

/// Benchmark fraud detection performance
fn benchmark_detection_performance(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("fraud_detection", |b| {
        b.iter(|| {
            rt.block_on(async {
                let service = setup_test_service(None).await.unwrap();
                let test_transaction = serde_json::from_str(MOCK_TRANSACTION_DATA).unwrap();
                service.detect_fraud(test_transaction).await.unwrap()
            })
        })
    });
}

criterion_group!(
    name = benches;
    config = Criterion::default().sample_size(100);
    targets = benchmark_detection_performance
);
criterion_main!(benches);

// Helper functions for test data generation
fn generate_test_cases(pattern: &str, count: usize) -> Result<Vec<TestCase>, SecurityError> {
    let mut cases = Vec::with_capacity(count);
    for _ in 0..count {
        cases.push(TestCase {
            transaction: generate_transaction(pattern)?,
            expected_fraud: is_fraudulent_pattern(pattern),
        });
    }
    Ok(cases)
}

#[derive(Clone)]
struct TestCase {
    transaction: serde_json::Value,
    expected_fraud: bool,
}

fn generate_transaction(pattern: &str) -> Result<serde_json::Value, SecurityError> {
    Ok(json!({
        "pattern": pattern,
        "timestamp": chrono::Utc::now(),
        "amount": rand::random::<f64>() * 10.0,
        "user_id": TEST_USER_ID,
    }))
}

fn is_fraudulent_pattern(pattern: &str) -> bool {
    TEST_TRANSACTION_PATTERNS.contains(&pattern)
}