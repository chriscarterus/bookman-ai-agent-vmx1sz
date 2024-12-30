/**
 * @fileoverview TypeScript type definitions for portfolio management
 * @version 1.0.0
 * @license MIT
 */

import { MarketData } from '../types/market.types';

/**
 * Supported asset types in the portfolio system
 * Using const assertion for type safety and autocompletion
 */
export const ASSET_TYPES = ['cryptocurrency', 'token', 'nft'] as const;

/**
 * Supported transaction types in the portfolio system
 * Using const assertion for type safety and autocompletion
 */
export const TRANSACTION_TYPES = ['buy', 'sell', 'transfer', 'stake', 'unstake'] as const;

/**
 * Type-safe asset types derived from const array
 */
export type AssetType = typeof ASSET_TYPES[number];

/**
 * Type-safe transaction types derived from const array
 */
export type TransactionType = typeof TRANSACTION_TYPES[number];

/**
 * Portfolio interface representing a user's cryptocurrency portfolio
 * Implements ACID compliance through strict typing and timestamp tracking
 */
export interface Portfolio {
  /** Unique identifier for the portfolio */
  readonly portfolio_id: string;
  /** Associated user identifier */
  readonly user_id: string;
  /** Portfolio name */
  name: string;
  /** Optional portfolio description */
  description?: string;
  /** Array of assets in the portfolio */
  readonly assets: readonly Asset[];
  /** Total portfolio value in USD */
  total_value: number;
  /** Portfolio creation timestamp */
  readonly created_at: Date;
  /** Last portfolio update timestamp */
  updated_at: Date;
}

/**
 * Asset interface representing a single cryptocurrency asset
 * Includes real-time performance tracking and valuation
 */
export interface Asset {
  /** Unique identifier for the asset */
  readonly asset_id: string;
  /** Associated portfolio identifier */
  readonly portfolio_id: string;
  /** Trading symbol (e.g., BTC, ETH) */
  symbol: string;
  /** Asset type classification */
  type: AssetType;
  /** Asset quantity/holdings */
  quantity: number;
  /** Average purchase price in USD */
  average_buy_price: number;
  /** Current market price in USD */
  current_price: number;
  /** Total value of holdings in USD */
  total_value: number;
  /** Unrealized profit/loss in USD */
  profit_loss: number;
  /** Unrealized profit/loss percentage */
  profit_loss_percentage: number;
  /** Last price update timestamp */
  last_updated: Date;
}

/**
 * Transaction interface for tracking portfolio activities
 * Ensures comprehensive transaction history with ACID properties
 */
export interface Transaction {
  /** Unique identifier for the transaction */
  readonly transaction_id: string;
  /** Associated portfolio identifier */
  readonly portfolio_id: string;
  /** Associated asset identifier */
  readonly asset_id: string;
  /** Transaction type */
  type: TransactionType;
  /** Transaction quantity */
  quantity: number;
  /** Price per unit in USD */
  price: number;
  /** Total transaction amount in USD */
  total_amount: number;
  /** Transaction fee in USD */
  fee: number;
  /** Transaction timestamp */
  readonly timestamp: Date;
  /** Transaction status */
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Portfolio performance metrics interface
 * Provides comprehensive analytics and historical performance data
 */
export interface PortfolioPerformance {
  /** Associated portfolio identifier */
  readonly portfolio_id: string;
  /** Current total portfolio value in USD */
  total_value: number;
  /** Total investment cost in USD */
  total_cost: number;
  /** Total unrealized profit/loss in USD */
  total_profit_loss: number;
  /** Total profit/loss percentage */
  profit_loss_percentage: number;
  /** Time period for performance calculation */
  time_period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  /** Historical performance data points */
  performance_history: Array<{
    timestamp: Date;
    value: number;
  }>;
  /** Best performing asset in the portfolio */
  best_performing_asset: {
    asset_id: string;
    profit_percentage: number;
  };
  /** Worst performing asset in the portfolio */
  worst_performing_asset: {
    asset_id: string;
    profit_percentage: number;
  };
  /** Performance calculation timestamp */
  readonly timestamp: Date;
}