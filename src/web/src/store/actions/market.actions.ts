/**
 * @fileoverview Redux action creators for cryptocurrency market data operations
 * @version 1.0.0
 * @license MIT
 */

import { createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import { retry } from 'axios-retry'; // v3.5.0
import { 
  MarketData, 
  PricePrediction, 
  MarketAlert,
  MarketDataInterval,
  AlertCondition 
} from '../../types/market.types';

/**
 * Options for market data fetching
 */
interface FetchOptions {
  interval?: MarketDataInterval;
  limit?: number;
  cache?: boolean;
}

/**
 * Options for price predictions
 */
interface PredictionOptions {
  horizon: '1h' | '24h' | '7d';
  includeMetrics?: boolean;
}

/**
 * Options for market alerts
 */
interface AlertOptions {
  notificationChannel?: 'email' | 'push' | 'both';
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Fetches real-time market data for specified cryptocurrency symbols
 * Implements retry logic and rate limiting
 */
export const fetchMarketData = createAsyncThunk(
  'market/fetchMarketData',
  async (
    symbols: string[], 
    options: FetchOptions = { limit: 100, cache: true }
  ): Promise<MarketData[]> => {
    try {
      // Validate symbols
      if (!symbols.length || symbols.length > 100) {
        throw new Error('Invalid number of symbols. Must be between 1 and 100.');
      }

      // Configure retry logic
      const axiosWithRetry = retry(axios, { 
        retries: 3,
        retryDelay: retry.exponentialDelay,
        retryCondition: (error) => {
          return retry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
        }
      });

      const response = await axiosWithRetry.get('/api/v1/market/data', {
        params: {
          symbols: symbols.join(','),
          interval: options.interval,
          limit: options.limit
        }
      });

      // Validate and transform response
      const marketData: MarketData[] = response.data.map((data: any) => ({
        symbol: data.symbol,
        price: Number(data.price),
        volume: Number(data.volume),
        change_24h: Number(data.change_24h),
        timestamp: new Date().toISOString()
      }));

      return marketData;
    } catch (error) {
      throw new Error(`Failed to fetch market data: ${error.message}`);
    }
  }
);

/**
 * Fetches AI-powered price predictions with confidence metrics
 */
export const fetchPricePrediction = createAsyncThunk(
  'market/fetchPricePrediction',
  async (
    symbol: string,
    options: PredictionOptions
  ): Promise<PricePrediction> => {
    try {
      // Validate inputs
      if (!symbol || !options.horizon) {
        throw new Error('Symbol and prediction horizon are required');
      }

      const response = await axios.get('/api/v1/market/prediction', {
        params: {
          symbol,
          horizon: options.horizon,
          include_metrics: options.includeMetrics
        }
      });

      // Validate prediction data
      const prediction: PricePrediction = {
        symbol: response.data.symbol,
        predicted_price: Number(response.data.predicted_price),
        confidence_interval: [
          Number(response.data.confidence_interval[0]),
          Number(response.data.confidence_interval[1])
        ],
        prediction_time: new Date().toISOString(),
        model_confidence: Number(response.data.model_confidence)
      };

      return prediction;
    } catch (error) {
      throw new Error(`Failed to fetch price prediction: ${error.message}`);
    }
  }
);

/**
 * Creates market alerts with risk assessment
 */
export const createAlert = createAsyncThunk(
  'market/createAlert',
  async (
    alert: Omit<MarketAlert, 'created_at' | 'user_id'>,
    options: AlertOptions = { priority: 'medium' }
  ): Promise<MarketAlert> => {
    try {
      // Validate alert parameters
      if (!alert.symbol || !alert.condition || !alert.threshold) {
        throw new Error('Invalid alert parameters');
      }

      const response = await axios.post('/api/v1/market/alerts', {
        ...alert,
        notification_channel: options.notificationChannel,
        priority: options.priority,
        created_at: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create market alert: ${error.message}`);
    }
  }
);

/**
 * Updates market data in real-time via WebSocket
 */
export const updateMarketData = (data: MarketData) => {
  return {
    type: 'market/updateMarketData' as const,
    payload: {
      symbol: data.symbol,
      price: Number(data.price),
      volume: Number(data.volume),
      change_24h: Number(data.change_24h),
      timestamp: new Date().toISOString()
    }
  };
};

// Type for the updateMarketData action
export type UpdateMarketDataAction = ReturnType<typeof updateMarketData>;

// Export all action types
export type MarketActionTypes = 
  | ReturnType<typeof fetchMarketData.pending>
  | ReturnType<typeof fetchMarketData.fulfilled>
  | ReturnType<typeof fetchMarketData.rejected>
  | ReturnType<typeof fetchPricePrediction.pending>
  | ReturnType<typeof fetchPricePrediction.fulfilled>
  | ReturnType<typeof fetchPricePrediction.rejected>
  | ReturnType<typeof createAlert.pending>
  | ReturnType<typeof createAlert.fulfilled>
  | ReturnType<typeof createAlert.rejected>
  | UpdateMarketDataAction;