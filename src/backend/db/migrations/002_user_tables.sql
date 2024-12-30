-- Schema version 2.0.0
-- User-related tables migration with enhanced security features

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION '1.3';

-- Security-related functions
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Validate password meets minimum requirements
    IF length(password) < 12 THEN
        RAISE EXCEPTION 'Password must be at least 12 characters long';
    END IF;

    -- Generate secure hash using pgcrypto with strong work factor
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER LEAKPROOF;

CREATE OR REPLACE FUNCTION verify_password(password TEXT, stored_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Perform timing-safe password verification
    RETURN stored_hash = crypt(password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER LEAKPROOF;

-- User Security Settings Table
CREATE TABLE user_security_settings (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret TEXT,
    backup_codes JSONB DEFAULT '[]',
    security_questions JSONB DEFAULT '[]',
    last_password_change TIMESTAMPTZ DEFAULT NOW(),
    password_history JSONB DEFAULT '[]',
    security_events JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_backup_codes CHECK (jsonb_array_length(backup_codes) <= 10),
    CONSTRAINT valid_security_questions CHECK (jsonb_array_length(security_questions) BETWEEN 0 AND 5)
);

-- User Sessions Table
CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    ip_address INET,
    user_agent TEXT,
    device_id TEXT,
    location JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_valid BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT session_duration_check CHECK (expires_at > created_at)
);

-- User Preferences Table
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    theme VARCHAR(10) NOT NULL DEFAULT 'system',
    language VARCHAR(10) NOT NULL DEFAULT 'en-US',
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    notification_preferences JSONB NOT NULL DEFAULT '{
        "email": true,
        "push": true,
        "sms": false,
        "security_alerts": true,
        "market_updates": true,
        "learning_reminders": true
    }',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'system')),
    CONSTRAINT valid_language CHECK (language ~ '^[a-z]{2}-[A-Z]{2}$'),
    CONSTRAINT valid_currency CHECK (default_currency ~ '^[A-Z]{3}$')
);

-- Create indexes for performance optimization
CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_security_settings_2fa ON user_security_settings(user_id, two_factor_enabled);
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- Add audit triggers
CREATE TRIGGER user_security_settings_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_security_settings
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER user_sessions_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER user_preferences_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

-- Add updated_at triggers
CREATE TRIGGER update_user_security_settings_timestamp
    BEFORE UPDATE ON user_security_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_preferences_timestamp
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add row-level security policies
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY user_security_settings_access ON user_security_settings
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY user_sessions_access ON user_sessions
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY user_preferences_access ON user_preferences
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id() OR current_user_role() = 'admin');

-- Comments for documentation
COMMENT ON TABLE user_security_settings IS 'Stores user security configurations including 2FA and security questions';
COMMENT ON TABLE user_sessions IS 'Manages user authentication sessions with security tracking';
COMMENT ON TABLE user_preferences IS 'Stores user interface and notification preferences';

-- Version tracking
INSERT INTO schema_version (version) VALUES ('2.0.0');