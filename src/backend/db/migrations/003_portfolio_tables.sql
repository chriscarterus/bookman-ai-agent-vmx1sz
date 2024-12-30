-- Schema version: 1.0.0
-- Description: Portfolio management tables with enhanced security and performance features

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- v1.3 - Required for encryption and UUID generation

-- Create custom types for portfolio management
CREATE TYPE portfolio_risk_level AS ENUM ('conservative', 'moderate', 'aggressive');
CREATE TYPE portfolio_asset_type AS ENUM ('cryptocurrency', 'token', 'nft');
CREATE TYPE portfolio_transaction_type AS ENUM ('buy', 'sell', 'transfer', 'stake', 'unstake');

-- Create portfolios table with enhanced security
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    risk_level portfolio_risk_level NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    encryption_key_id UUID,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_name CHECK (length(trim(name)) > 0),
    CONSTRAINT max_tags CHECK (array_length(tags, 1) <= 10)
);

-- Create portfolio assets table
CREATE TABLE portfolio_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    type portfolio_asset_type NOT NULL,
    quantity DECIMAL(24,8) NOT NULL,
    average_buy_price DECIMAL(24,8) NOT NULL,
    current_price DECIMAL(24,8) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    CONSTRAINT positive_quantity CHECK (quantity >= 0),
    CONSTRAINT positive_prices CHECK (average_buy_price >= 0 AND current_price >= 0),
    CONSTRAINT valid_symbol CHECK (symbol ~* '^[A-Z0-9]{2,10}$')
);

-- Create portfolio transactions table
CREATE TABLE portfolio_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES portfolio_assets(asset_id),
    type portfolio_transaction_type NOT NULL,
    quantity DECIMAL(24,8) NOT NULL,
    price DECIMAL(24,8) NOT NULL,
    fee DECIMAL(24,8) DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blockchain_tx_hash TEXT,
    notes TEXT,
    CONSTRAINT positive_transaction_values CHECK (
        quantity > 0 AND 
        price >= 0 AND 
        fee >= 0
    ),
    CONSTRAINT valid_blockchain_hash CHECK (
        blockchain_tx_hash IS NULL OR 
        blockchain_tx_hash ~* '^0x[a-fA-F0-9]{64}$'
    )
);

-- Create portfolio performance tracking table
CREATE TABLE portfolio_performance (
    performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    total_value DECIMAL(24,8) NOT NULL,
    total_cost DECIMAL(24,8) NOT NULL,
    total_profit_loss DECIMAL(24,8) NOT NULL,
    profit_loss_percentage DECIMAL(8,2),
    risk_metrics JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_performance_values CHECK (
        total_value >= 0 AND
        total_cost >= 0
    )
);

-- Create function to calculate portfolio performance
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(p_portfolio_id UUID)
RETURNS TABLE (
    total_value DECIMAL(24,8),
    total_cost DECIMAL(24,8),
    profit_loss DECIMAL(24,8),
    profit_loss_pct DECIMAL(8,2)
) 
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
BEGIN
    RETURN QUERY
    WITH asset_values AS (
        SELECT 
            SUM(quantity * current_price) as current_value,
            SUM(quantity * average_buy_price) as investment_cost
        FROM portfolio_assets
        WHERE portfolio_id = p_portfolio_id
    )
    SELECT 
        current_value,
        investment_cost,
        (current_value - investment_cost) as pl,
        CASE 
            WHEN investment_cost > 0 THEN 
                ROUND(((current_value - investment_cost) / investment_cost * 100)::numeric, 2)
            ELSE 0
        END as pl_pct
    FROM asset_values;
END;
$$ LANGUAGE plpgsql;

-- Create function to update average buy price
CREATE OR REPLACE FUNCTION update_average_buy_price(p_asset_id UUID)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
    UPDATE portfolio_assets
    SET average_buy_price = (
        SELECT CASE
            WHEN SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END) > 0
            THEN SUM(CASE WHEN type = 'buy' THEN quantity * price ELSE 0 END) / 
                 SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END)
            ELSE 0
        END
        FROM portfolio_transactions
        WHERE asset_id = p_asset_id
        AND type = 'buy'
    )
    WHERE asset_id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_assets_portfolio_id 
ON portfolio_assets(portfolio_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_assets_symbol 
ON portfolio_assets(symbol);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_transactions_portfolio_id 
ON portfolio_transactions(portfolio_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_transactions_asset_id 
ON portfolio_transactions(asset_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_performance_portfolio_id 
ON portfolio_performance(portfolio_id, timestamp DESC);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_portfolios_timestamp
    BEFORE UPDATE ON portfolios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Add audit trail triggers
CREATE TRIGGER portfolios_audit
    AFTER INSERT OR UPDATE OR DELETE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER portfolio_assets_audit
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_assets
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER portfolio_transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_transactions
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

-- Enable row-level security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY portfolios_access ON portfolios
    FOR ALL
    TO authenticated
    USING (user_id = current_user_id());

CREATE POLICY portfolio_assets_access ON portfolio_assets
    FOR ALL
    TO authenticated
    USING (portfolio_id IN (
        SELECT portfolio_id FROM portfolios 
        WHERE user_id = current_user_id()
    ));

CREATE POLICY portfolio_transactions_access ON portfolio_transactions
    FOR ALL
    TO authenticated
    USING (portfolio_id IN (
        SELECT portfolio_id FROM portfolios 
        WHERE user_id = current_user_id()
    ));

CREATE POLICY portfolio_performance_access ON portfolio_performance
    FOR ALL
    TO authenticated
    USING (portfolio_id IN (
        SELECT portfolio_id FROM portfolios 
        WHERE user_id = current_user_id()
    ));

-- Add table comments
COMMENT ON TABLE portfolios IS 'User cryptocurrency portfolios with risk assessment and security features';
COMMENT ON TABLE portfolio_assets IS 'Individual cryptocurrency holdings within portfolios';
COMMENT ON TABLE portfolio_transactions IS 'Historical record of portfolio transactions';
COMMENT ON TABLE portfolio_performance IS 'Time-series portfolio performance metrics';