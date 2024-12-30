use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use lazy_static::lazy_static;

// Import proto message types
use crate::proto::security::SecurityAlert;

lazy_static! {
    static ref ALERT_SEVERITY_LEVELS: Vec<&'static str> = vec!["low", "medium", "high", "critical"];
    static ref ALERT_STATUS_TYPES: Vec<&'static str> = vec!["new", "acknowledged", "in_progress", "resolved", "closed"];
    static ref ALERT_STATUS_TRANSITIONS: HashMap<&'static str, Vec<&'static str>> = {
        let mut m = HashMap::new();
        m.insert("new", vec!["acknowledged"]);
        m.insert("acknowledged", vec!["in_progress", "closed"]);
        m.insert("in_progress", vec!["resolved", "closed"]);
        m.insert("resolved", vec!["closed"]);
        m.insert("closed", vec![]);
        m
    };
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusTransition {
    from_status: String,
    to_status: String,
    transition_time: DateTime<Utc>,
    transition_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    alert_id: String,
    severity: String,
    description: String,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: Option<DateTime<Utc>>,
    user_id: String,
    resolution_notes: Option<String>,
    status_history: Vec<StatusTransition>,
}

impl Alert {
    /// Creates a new Alert instance with validated data
    pub fn new(severity: String, description: String, user_id: String) -> Result<Self, String> {
        // Validate severity level
        validate_severity(&severity)?;

        Ok(Alert {
            alert_id: Uuid::new_v4().to_string(),
            severity,
            description,
            status: "new".to_string(),
            created_at: Utc::now(),
            updated_at: None,
            user_id,
            resolution_notes: None,
            status_history: Vec::new(),
        })
    }

    /// Updates the alert status with transition validation
    pub fn update_status(&mut self, new_status: String, transition_notes: String) -> Result<(), String> {
        // Validate status transition
        validate_status_transition(&self.status, &new_status)?;

        // Record current status in history
        let transition = StatusTransition {
            from_status: self.status.clone(),
            to_status: new_status.clone(),
            transition_time: Utc::now(),
            transition_notes: Some(transition_notes),
        };

        self.status = new_status;
        self.updated_at = Some(Utc::now());
        self.status_history.push(transition);

        Ok(())
    }

    /// Adds resolution notes with timestamp tracking
    pub fn add_resolution_notes(&mut self, notes: String) -> Result<(), String> {
        if notes.trim().is_empty() {
            return Err("Resolution notes cannot be empty".to_string());
        }

        self.resolution_notes = Some(notes);
        self.updated_at = Some(Utc::now());

        Ok(())
    }

    /// Converts Alert to protobuf message
    pub fn to_proto(&self) -> Result<SecurityAlert, String> {
        let mut proto_alert = SecurityAlert::default();
        
        proto_alert.alert_id = self.alert_id.clone();
        proto_alert.severity = self.severity.clone();
        proto_alert.description = self.description.clone();
        proto_alert.status = self.status.clone();
        
        // Convert timestamps
        proto_alert.created_at = Some(prost_types::Timestamp {
            seconds: self.created_at.timestamp(),
            nanos: self.created_at.timestamp_subsec_nanos() as i32,
        });

        if let Some(updated) = self.updated_at {
            proto_alert.updated_at = Some(prost_types::Timestamp {
                seconds: updated.timestamp(),
                nanos: updated.timestamp_subsec_nanos() as i32,
            });
        }

        Ok(proto_alert)
    }
}

/// Validates if the provided severity level is valid
pub fn validate_severity(severity: &str) -> Result<bool, String> {
    if ALERT_SEVERITY_LEVELS.contains(&severity) {
        Ok(true)
    } else {
        Err(format!(
            "Invalid severity level: '{}'. Must be one of: {:?}",
            severity, *ALERT_SEVERITY_LEVELS
        ))
    }
}

/// Validates if the status transition is allowed
pub fn validate_status_transition(current_status: &str, new_status: &str) -> Result<bool, String> {
    // Validate both statuses exist
    if !ALERT_STATUS_TYPES.contains(&current_status) {
        return Err(format!("Invalid current status: '{}'", current_status));
    }
    if !ALERT_STATUS_TYPES.contains(&new_status) {
        return Err(format!("Invalid new status: '{}'", new_status));
    }

    // Check if transition is allowed
    if let Some(allowed_transitions) = ALERT_STATUS_TRANSITIONS.get(current_status) {
        if allowed_transitions.contains(&new_status) {
            Ok(true)
        } else {
            Err(format!(
                "Invalid status transition from '{}' to '{}'. Allowed transitions: {:?}",
                current_status, new_status, allowed_transitions
            ))
        }
    } else {
        Err(format!("No transitions allowed from status: '{}'", current_status))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alert_creation() {
        let alert = Alert::new(
            "high".to_string(),
            "Suspicious activity detected".to_string(),
            "user123".to_string(),
        );
        assert!(alert.is_ok());
        let alert = alert.unwrap();
        assert_eq!(alert.status, "new");
        assert!(alert.status_history.is_empty());
    }

    #[test]
    fn test_invalid_severity() {
        let alert = Alert::new(
            "invalid".to_string(),
            "Test description".to_string(),
            "user123".to_string(),
        );
        assert!(alert.is_err());
    }

    #[test]
    fn test_status_transition() {
        let mut alert = Alert::new(
            "high".to_string(),
            "Test alert".to_string(),
            "user123".to_string(),
        ).unwrap();
        
        let result = alert.update_status(
            "acknowledged".to_string(),
            "Acknowledging alert".to_string(),
        );
        assert!(result.is_ok());
        assert_eq!(alert.status, "acknowledged");
        assert_eq!(alert.status_history.len(), 1);
    }

    #[test]
    fn test_invalid_status_transition() {
        let mut alert = Alert::new(
            "high".to_string(),
            "Test alert".to_string(),
            "user123".to_string(),
        ).unwrap();
        
        let result = alert.update_status(
            "resolved".to_string(),
            "Invalid transition".to_string(),
        );
        assert!(result.is_err());
    }
}