-- Schema version: 1.0.0
-- Description: Initial database migration establishing core schema with security features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- v1.1 - UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- v1.3 - Enhanced cryptography
CREATE EXTENSION IF NOT EXISTS "timescaledb";    -- v2.11.0 - Time-series optimization

-- Create custom types
CREATE TYPE user_role AS ENUM ('guest', 'user', 'premium', 'admin', 'security');
CREATE TYPE asset_type AS ENUM ('cryptocurrency', 'token', 'nft');
CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'transfer', 'stake', 'unstake', 'swap', 'yield_harvest', 'fee');

-- Create audit trail table
CREATE TABLE audit_trail (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip INET,
    user_agent TEXT
);

-- Create function for audit trail
CREATE OR REPLACE FUNCTION create_audit_trail() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_trail (
        table_name,
        operation,
        old_data,
        new_data,
        changed_by,
        client_ip,
        user_agent
    )
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        COALESCE(current_setting('app.current_user_id', true)::UUID, uuid_nil()),
        COALESCE(current_setting('app.client_ip', true)::INET, NULL),
        current_setting('app.user_agent', true)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create users table with enhanced security
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'email',
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    security_settings JSONB NOT NULL DEFAULT '{
        "two_factor_enabled": false,
        "backup_codes": [],
        "security_questions": [],
        "last_password_change": null,
        "security_events": []
    }',
    preferences JSONB NOT NULL DEFAULT '{
        "theme": "system",
        "language": "en-US",
        "notifications_enabled": true,
        "default_currency": "USD",
        "timezone": "UTC"
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_-]{3,30}$'),
    CONSTRAINT max_failed_attempts CHECK (failed_login_attempts BETWEEN 0 AND 5)
);

-- Create portfolios table
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('conservative', 'moderate', 'aggressive')),
    CONSTRAINT max_tags CHECK (array_length(tags, 1) <= 10)
);

-- Create market_data table with TimescaleDB hypertable
CREATE TABLE market_data (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(24,8) NOT NULL,
    volume DECIMAL(24,8) NOT NULL,
    change_24h DECIMAL(8,2),
    bid DECIMAL(24,8),
    ask DECIMAL(24,8),
    market_cap DECIMAL(24,2),
    timestamp TIMESTAMPTZ NOT NULL,
    CONSTRAINT valid_symbol CHECK (symbol ~* '^[A-Z0-9]{2,10}$'),
    CONSTRAINT positive_price CHECK (price >= 0),
    CONSTRAINT positive_volume CHECK (volume >= 0)
);

-- Convert market_data to hypertable
SELECT create_hypertable('market_data', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create compression policy for market_data
SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- Create portfolio_assets table
CREATE TABLE portfolio_assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id),
    symbol VARCHAR(20) NOT NULL,
    type asset_type NOT NULL,
    quantity DECIMAL(24,8) NOT NULL,
    average_buy_price DECIMAL(24,8) NOT NULL,
    current_price DECIMAL(24,8) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    CONSTRAINT positive_quantity CHECK (quantity >= 0),
    CONSTRAINT positive_prices CHECK (average_buy_price >= 0 AND current_price >= 0)
);

-- Add audit triggers
CREATE TRIGGER users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER portfolios_audit
    AFTER INSERT OR UPDATE OR DELETE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER portfolio_assets_audit
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_assets
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

-- Create indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_symbol 
    ON market_data(symbol, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_assets_portfolio 
    ON portfolio_assets(portfolio_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolios_user 
    ON portfolios(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
    ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_trail_table 
    ON audit_trail(table_name, changed_at DESC);

-- Set up row-level security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY users_access ON users
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id() OR role = 'admin');

CREATE POLICY portfolios_access ON portfolios
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id() OR role = 'admin');

CREATE POLICY portfolio_assets_access ON portfolio_assets
    FOR ALL
    TO authenticated
    USING (portfolio_id IN (
        SELECT portfolio_id FROM portfolios 
        WHERE user_id = current_user_id()
    ) OR role = 'admin');

-- Create retention policy function
CREATE OR REPLACE FUNCTION cleanup_old_audit_trails() RETURNS void AS $$
BEGIN
    DELETE FROM audit_trail 
    WHERE changed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job for audit trail cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('0 0 * * *', $$SELECT cleanup_old_audit_trails()$$);

COMMENT ON TABLE users IS 'Core user accounts with enhanced security features';
COMMENT ON TABLE portfolios IS 'User cryptocurrency portfolios with risk assessment';
COMMENT ON TABLE market_data IS 'Time-series cryptocurrency market data';
COMMENT ON TABLE portfolio_assets IS 'Individual portfolio asset holdings';
COMMENT ON TABLE audit_trail IS 'Security audit trail for data changes';