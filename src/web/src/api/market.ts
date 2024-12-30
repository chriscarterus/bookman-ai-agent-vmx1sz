/**
 * Market API Client Module
 * @version 1.0.0
 * @description Handles cryptocurrency market data operations with enhanced security and validation
 */

// External imports
import axios, { AxiosError } from 'axios'; // ^1.4.0

// Internal imports
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  MarketData, 
  MarketDataInterval, 
  HistoricalMarketData,
  PricePrediction,
  MarketAlert,
  MARKET_DATA_INTERVALS 
} from '../types/market.types';

// Cache configuration
const CACHE_TTL = 5000; // 5 seconds for real-time data
const marketDataCache = new Map<string, { data: MarketData; timestamp: number }>();

/**
 * Validates market data symbols
 * @param symbols Array of cryptocurrency symbols to validate
 * @throws Error if symbols are invalid
 */
const validateSymbols = (symbols: string[]): void => {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Invalid symbols array');
  }
  if (symbols.some(symbol => typeof symbol !== 'string' || !symbol.trim())) {
    throw new Error('Invalid symbol format');
  }
}

/**
 * Validates market data interval
 * @param interval Time interval for market data
 * @throws Error if interval is invalid
 */
const validateInterval = (interval: MarketDataInterval): void => {
  if (!MARKET_DATA_INTERVALS.includes(interval)) {
    throw new Error(`Invalid interval. Must be one of: ${MARKET_DATA_INTERVALS.join(', ')}`);
  }
}

/**
 * Checks if cached data is still valid
 * @param symbol Cryptocurrency symbol
 * @returns boolean indicating if cache is valid
 */
const isCacheValid = (symbol: string): boolean => {
  const cached = marketDataCache.get(symbol);
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL;
}

/**
 * Fetches real-time market data for specified cryptocurrencies
 * @param symbols Array of cryptocurrency symbols
 * @returns Promise resolving to array of market data
 */
export const getMarketData = async (symbols: string[]): Promise<MarketData[]> => {
  try {
    // Validate input
    validateSymbols(symbols);

    // Check cache for valid data
    const cachedData: MarketData[] = [];
    const symbolsToFetch: string[] = [];

    symbols.forEach(symbol => {
      if (isCacheValid(symbol)) {
        const cached = marketDataCache.get(symbol)!;
        cachedData.push(cached.data);
      } else {
        symbolsToFetch.push(symbol);
      }
    });

    // If all data is cached, return immediately
    if (symbolsToFetch.length === 0) {
      return cachedData;
    }

    // Fetch fresh data for remaining symbols
    const response = await apiClient.get<MarketData[]>(
      `${API_ENDPOINTS.MARKET.PRICES}`, {
        params: {
          symbols: symbolsToFetch.join(',')
        }
      }
    );

    // Validate response data
    const freshData = response.data.map(data => {
      if (!data.symbol || typeof data.price !== 'number') {
        throw new Error('Invalid market data format');
      }
      // Update cache
      marketDataCache.set(data.symbol, {
        data,
        timestamp: Date.now()
      });
      return data;
    });

    // Combine cached and fresh data
    return [...cachedData, ...freshData];

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Market data fetch failed: ${axiosError.message}`);
    }
    throw error;
  }
};

/**
 * Retrieves historical market data for a cryptocurrency
 * @param symbol Cryptocurrency symbol
 * @param interval Time interval for data aggregation
 * @param limit Number of data points to retrieve
 * @returns Promise resolving to array of historical market data
 */
export const getHistoricalData = async (
  symbol: string,
  interval: MarketDataInterval,
  limit: number = 100
): Promise<HistoricalMarketData[]> => {
  try {
    // Validate inputs
    validateSymbols([symbol]);
    validateInterval(interval);
    
    if (limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit. Must be between 1 and 1000');
    }

    const response = await apiClient.get<HistoricalMarketData[]>(
      `${API_ENDPOINTS.MARKET.HISTORICAL}`, {
        params: {
          symbol,
          interval,
          limit
        }
      }
    );

    // Validate response data
    return response.data.map(data => {
      if (!data.symbol || !data.timestamp || 
          typeof data.open !== 'number' || 
          typeof data.high !== 'number' || 
          typeof data.low !== 'number' || 
          typeof data.close !== 'number' || 
          typeof data.volume !== 'number') {
        throw new Error('Invalid historical data format');
      }
      return data;
    });

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Historical data fetch failed: ${axiosError.message}`);
    }
    throw error;
  }
};

/**
 * Fetches price predictions for a cryptocurrency
 * @param symbol Cryptocurrency symbol
 * @returns Promise resolving to price prediction data
 */
export const getPricePrediction = async (symbol: string): Promise<PricePrediction> => {
  try {
    validateSymbols([symbol]);

    const response = await apiClient.get<PricePrediction>(
      `${API_ENDPOINTS.MARKET.PREDICTIONS}/${symbol}`
    );

    // Validate prediction data
    const prediction = response.data;
    if (!prediction.symbol || 
        typeof prediction.predicted_price !== 'number' || 
        !Array.isArray(prediction.confidence_interval) || 
        prediction.confidence_interval.length !== 2) {
      throw new Error('Invalid prediction data format');
    }

    return prediction;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Prediction fetch failed: ${axiosError.message}`);
    }
    throw error;
  }
};

/**
 * Creates a new market price alert
 * @param alert Market alert configuration
 * @returns Promise resolving to created alert
 */
export const createMarketAlert = async (alert: Omit<MarketAlert, 'created_at'>): Promise<MarketAlert> => {
  try {
    validateSymbols([alert.symbol]);

    if (typeof alert.threshold !== 'number' || alert.threshold <= 0) {
      throw new Error('Invalid alert threshold');
    }

    const response = await apiClient.post<MarketAlert>(
      API_ENDPOINTS.MARKET.ALERTS,
      alert
    );

    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Alert creation failed: ${axiosError.message}`);
    }
    throw error;
  }
};

export type { 
  MarketData,
  HistoricalMarketData,
  PricePrediction,
  MarketAlert,
  MarketDataInterval
};