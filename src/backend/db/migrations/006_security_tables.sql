-- Migration: Security Tables for Bookman AI Platform
-- Version: 6.0.0
-- Description: Establishes security-related tables for fraud detection, smart contract auditing, and security alerts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Declare constants for validation
DO $$ BEGIN
    -- Define supported alert types
    CREATE TYPE alert_type_enum AS ENUM (
        'fraud',
        'smart_contract_vulnerability',
        'suspicious_activity',
        'security_breach',
        'access_violation',
        'data_leak'
    );
    
    -- Define severity levels
    CREATE TYPE severity_level_enum AS ENUM (
        'low',
        'medium',
        'high',
        'critical',
        'emergency'
    );
    
    -- Define alert status
    CREATE TYPE alert_status_enum AS ENUM (
        'open',
        'investigating',
        'resolved',
        'false_positive'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create security alerts table with encryption support
CREATE TABLE IF NOT EXISTS security_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    alert_type alert_type_enum NOT NULL,
    severity severity_level_enum NOT NULL,
    details JSONB NOT NULL,
    encrypted_data BYTEA, -- For sensitive data requiring encryption
    status alert_status_enum NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolution_notes TEXT,
    metadata JSONB -- Additional metadata for analysis
);

-- Create audit trail table for security events
CREATE TABLE IF NOT EXISTS security_audit_trail (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES security_alerts(alert_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    performed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    additional_context JSONB
);

-- Create indexes for performance optimization
CREATE INDEX idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_type_severity ON security_alerts(alert_type, severity);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);
CREATE INDEX idx_security_alerts_created ON security_alerts(created_at) WHERE status = 'open';
CREATE INDEX idx_security_audit_trail_alert ON security_audit_trail(alert_id);
CREATE INDEX idx_security_audit_trail_timestamp ON security_audit_trail(action_timestamp);

-- Create function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(
        data,
        current_setting('app.encryption_key')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(
        encrypted_data,
        current_setting('app.encryption_key')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create security alert with validation
CREATE OR REPLACE FUNCTION create_security_alert(
    p_user_id UUID,
    p_alert_type alert_type_enum,
    p_severity severity_level_enum,
    p_details JSONB,
    p_encrypted_data TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'Invalid user_id';
    END IF;

    -- Insert security alert
    INSERT INTO security_alerts (
        user_id,
        alert_type,
        severity,
        details,
        encrypted_data,
        metadata
    ) VALUES (
        p_user_id,
        p_alert_type,
        p_severity,
        p_details,
        CASE 
            WHEN p_encrypted_data IS NOT NULL THEN encrypt_sensitive_data(p_encrypted_data)
            ELSE NULL
        END,
        jsonb_build_object(
            'created_by', current_user,
            'source_ip', inet_client_addr(),
            'source_port', inet_client_port()
        )
    )
    RETURNING alert_id INTO v_alert_id;

    -- Create audit trail entry
    INSERT INTO security_audit_trail (
        alert_id,
        action_type,
        performed_by,
        ip_address,
        user_agent,
        changes
    ) VALUES (
        v_alert_id,
        'alert_created',
        p_user_id,
        inet_client_addr(),
        current_setting('app.http_user_agent', true),
        jsonb_build_object(
            'alert_type', p_alert_type,
            'severity', p_severity,
            'details', p_details
        )
    );

    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create update trigger for security_alerts
CREATE OR REPLACE FUNCTION security_alerts_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Create audit trail entry for updates
    INSERT INTO security_audit_trail (
        alert_id,
        action_type,
        performed_by,
        ip_address,
        changes
    ) VALUES (
        NEW.alert_id,
        'alert_updated',
        current_setting('app.current_user_id', true)::UUID,
        inet_client_addr(),
        jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'old_severity', OLD.severity,
            'new_severity', NEW.severity
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_alerts_update
    BEFORE UPDATE ON security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION security_alerts_update_trigger();

-- Grant appropriate permissions
GRANT SELECT, INSERT ON security_alerts TO api_user;
GRANT SELECT, INSERT ON security_audit_trail TO api_user;
GRANT EXECUTE ON FUNCTION create_security_alert TO api_user;
GRANT EXECUTE ON FUNCTION encrypt_sensitive_data TO api_user;
GRANT EXECUTE ON FUNCTION decrypt_sensitive_data TO security_admin;

-- Create security policy for row-level security
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_alerts_access_policy ON security_alerts
    USING (
        current_setting('app.current_user_role')::TEXT = 'security_admin'
        OR (
            current_setting('app.current_user_role')::TEXT = 'admin'
            AND severity != 'emergency'
        )
        OR (
            user_id = current_setting('app.current_user_id')::UUID
            AND severity NOT IN ('critical', 'emergency')
        )
    );

-- Add comments for documentation
COMMENT ON TABLE security_alerts IS 'Stores security alerts and incidents with encryption support';
COMMENT ON TABLE security_audit_trail IS 'Audit trail for all security-related actions';
COMMENT ON FUNCTION create_security_alert IS 'Creates a new security alert with proper validation and audit logging';
COMMENT ON FUNCTION encrypt_sensitive_data IS 'Encrypts sensitive data using pgp_sym_encrypt';
COMMENT ON FUNCTION decrypt_sensitive_data IS 'Decrypts sensitive data using pgp_sym_decrypt';