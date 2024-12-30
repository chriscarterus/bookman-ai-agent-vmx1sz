/**
 * @fileoverview TypeScript type definitions for cryptocurrency market data
 * @version 1.0.0
 * @license MIT
 */

/**
 * Valid time intervals for market data aggregation
 */
export const MARKET_DATA_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;

/**
 * Type-safe market data intervals derived from const array
 */
export type MarketDataInterval = typeof MARKET_DATA_INTERVALS[number];

/**
 * Valid market alert condition types
 */
export const ALERT_CONDITION_TYPES = ['above', 'below', 'percent_increase', 'percent_decrease'] as const;

/**
 * Type-safe market alert conditions derived from const array
 */
export type AlertCondition = typeof ALERT_CONDITION_TYPES[number];

/**
 * Real-time market data interface
 * Contains current price, volume, and 24h change data
 */
export interface MarketData {
  /** Cryptocurrency trading symbol (e.g., BTC, ETH) */
  symbol: string;
  /** Current market price in USD */
  price: number;
  /** Current 24h trading volume in USD */
  volume: number;
  /** Price change percentage in last 24 hours */
  change_24h: number;
  /** ISO 8601 timestamp of the data point */
  timestamp: string;
}

/**
 * Historical OHLCV (Open, High, Low, Close, Volume) market data
 * Supports multiple time intervals for data aggregation
 */
export interface HistoricalMarketData {
  /** Cryptocurrency trading symbol */
  symbol: string;
  /** Time interval for data aggregation */
  interval: MarketDataInterval;
  /** Opening price for the interval */
  open: number;
  /** Highest price during the interval */
  high: number;
  /** Lowest price during the interval */
  low: number;
  /** Closing price for the interval */
  close: number;
  /** Trading volume during the interval */
  volume: number;
  /** ISO 8601 timestamp for the start of the interval */
  timestamp: string;
}

/**
 * Comprehensive market analytics and metrics
 * Includes market cap, supply information, and market ranking
 */
export interface MarketAnalytics {
  /** Cryptocurrency trading symbol */
  symbol: string;
  /** Total market capitalization in USD */
  market_cap: number;
  /** Trading volume in last 24 hours in USD */
  volume_24h: number;
  /** Current circulating supply of the cryptocurrency */
  circulating_supply: number;
  /** Total supply of the cryptocurrency */
  total_supply: number;
  /** Maximum supply (null if unlimited) */
  max_supply: number | null;
  /** Market cap rank */
  rank: number;
}

/**
 * Machine learning based price predictions
 * Includes confidence metrics and intervals for accuracy assessment
 */
export interface PricePrediction {
  /** Cryptocurrency trading symbol */
  symbol: string;
  /** ML-predicted price in USD */
  predicted_price: number;
  /** 95% confidence interval as [lower, upper] bounds */
  confidence_interval: [number, number];
  /** ISO 8601 timestamp for when prediction is valid */
  prediction_time: string;
  /** Model confidence score (0-1) */
  model_confidence: number;
}

/**
 * User-configurable market alerts
 * Supports various condition types and thresholds
 */
export interface MarketAlert {
  /** Cryptocurrency trading symbol */
  symbol: string;
  /** Alert condition type */
  condition: AlertCondition;
  /** Threshold value for the alert */
  threshold: number;
  /** User ID who created the alert */
  user_id: string;
  /** Whether the alert is currently active */
  active: boolean;
  /** ISO 8601 timestamp of alert creation */
  created_at: string;
}