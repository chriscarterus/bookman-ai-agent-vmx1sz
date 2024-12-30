-- Migration file for market data tables using TimescaleDB
-- Version: 1.0.0
-- Dependencies: TimescaleDB extension (from 001_init.sql)

-- Verify TimescaleDB extension is available
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) THEN
        RAISE EXCEPTION 'TimescaleDB extension is required but not installed';
    END IF;
END $$;

-- Create enum for supported intervals
CREATE TYPE market_interval AS ENUM ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w');

-- Real-time market data table
CREATE TABLE market_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol varchar(20) NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,10}$'),
    price decimal(20,8) NOT NULL CHECK (price >= 0),
    volume decimal(20,8) NOT NULL CHECK (volume >= 0),
    bid decimal(20,8) NOT NULL CHECK (bid >= 0),
    ask decimal(20,8) NOT NULL CHECK (ask >= 0),
    change_24h decimal(5,2) CHECK (change_24h BETWEEN -100 AND 1000),
    last_trade_id varchar(64) CHECK (last_trade_id ~ '^[a-zA-Z0-9-]{1,64}$'),
    timestamp timestamptz NOT NULL DEFAULT current_timestamp
);

-- Historical OHLCV data table
CREATE TABLE market_historical_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol varchar(20) NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,10}$'),
    interval market_interval NOT NULL,
    open decimal(20,8) NOT NULL CHECK (open >= 0),
    high decimal(20,8) NOT NULL CHECK (high >= 0),
    low decimal(20,8) NOT NULL CHECK (low >= 0),
    close decimal(20,8) NOT NULL CHECK (close >= 0),
    volume decimal(20,8) NOT NULL CHECK (volume >= 0),
    trades_count integer NOT NULL CHECK (trades_count >= 0),
    vwap decimal(20,8) NOT NULL CHECK (vwap >= 0),
    timestamp timestamptz NOT NULL
);

-- Market analytics and metrics table
CREATE TABLE market_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol varchar(20) NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,10}$'),
    market_cap decimal(30,2) NOT NULL CHECK (market_cap >= 0),
    volume_24h decimal(20,8) NOT NULL CHECK (volume_24h >= 0),
    circulating_supply decimal(30,8) NOT NULL CHECK (circulating_supply >= 0),
    total_supply decimal(30,8) NOT NULL CHECK (total_supply >= 0),
    max_supply decimal(30,8) CHECK (max_supply >= 0),
    rank integer NOT NULL CHECK (rank > 0),
    volatility_24h decimal(5,2) CHECK (volatility_24h BETWEEN 0 AND 1000),
    liquidity_score decimal(6,2) CHECK (liquidity_score BETWEEN 0 AND 1000),
    market_dominance decimal(5,2) CHECK (market_dominance BETWEEN 0 AND 100),
    timestamp timestamptz NOT NULL DEFAULT current_timestamp
);

-- Convert tables to hypertables and set up optimization policies
SELECT create_hypertable('market_data', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    create_default_indexes => TRUE
);

SELECT create_hypertable('market_historical_data', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    create_default_indexes => TRUE
);

SELECT create_hypertable('market_analytics', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    create_default_indexes => TRUE
);

-- Set up compression policies
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'timestamp DESC'
);

ALTER TABLE market_historical_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol,interval',
    timescaledb.compress_orderby = 'timestamp DESC'
);

ALTER TABLE market_analytics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'timestamp DESC'
);

-- Add compression policies (after 7 days)
SELECT add_compression_policy('market_data', INTERVAL '7 days');
SELECT add_compression_policy('market_historical_data', INTERVAL '7 days');
SELECT add_compression_policy('market_analytics', INTERVAL '7 days');

-- Set up retention policies (30 days for raw data)
SELECT add_retention_policy('market_data', INTERVAL '30 days');
SELECT add_retention_policy('market_historical_data', INTERVAL '365 days');
SELECT add_retention_policy('market_analytics', INTERVAL '365 days');

-- Create continuous aggregates for common queries
CREATE MATERIALIZED VIEW market_data_hourly
    WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    symbol,
    first(price, timestamp) as open,
    max(price) as high,
    min(price) as low,
    last(price, timestamp) as close,
    sum(volume) as volume
FROM market_data
GROUP BY bucket, symbol
WITH NO DATA;

CREATE MATERIALIZED VIEW market_data_daily
    WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    symbol,
    first(price, timestamp) as open,
    max(price) as high,
    min(price) as low,
    last(price, timestamp) as close,
    sum(volume) as volume
FROM market_data
GROUP BY bucket, symbol
WITH NO DATA;

-- Set refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('market_data_hourly',
    start_offset => INTERVAL '24 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('market_data_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Create indexes for common query patterns
CREATE INDEX idx_market_data_symbol_timestamp ON market_data (symbol, timestamp DESC);
CREATE INDEX idx_market_historical_symbol_interval ON market_historical_data (symbol, interval, timestamp DESC);
CREATE INDEX idx_market_analytics_rank ON market_analytics (rank, timestamp DESC);

-- Grant appropriate permissions
GRANT SELECT, INSERT ON market_data TO api_role;
GRANT SELECT, INSERT ON market_historical_data TO api_role;
GRANT SELECT, INSERT ON market_analytics TO api_role;
GRANT SELECT ON market_data_hourly TO api_role;
GRANT SELECT ON market_data_daily TO api_role;

-- Add comments for documentation
COMMENT ON TABLE market_data IS 'Real-time cryptocurrency market data with time-series optimization';
COMMENT ON TABLE market_historical_data IS 'Historical OHLCV data with interval-based aggregation';
COMMENT ON TABLE market_analytics IS 'Market analytics and metrics with time-series tracking';
COMMENT ON MATERIALIZED VIEW market_data_hourly IS 'Hourly OHLCV aggregates for market data';
COMMENT ON MATERIALIZED VIEW market_data_daily IS 'Daily OHLCV aggregates for market data';