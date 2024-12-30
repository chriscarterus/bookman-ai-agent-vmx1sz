/**
 * Enhanced Market Data Hook for Bookman AI Platform
 * @version 1.0.0
 * @description Custom React hook for managing real-time cryptocurrency market data
 * with AI-powered predictions, enhanced metrics, and improved reliability
 */

// External imports - v18.2.0
import { useState, useEffect, useCallback, useRef } from 'react';

// Internal imports
import { 
  MarketData, 
  MarketDataInterval, 
  PricePrediction,
  HistoricalMarketData 
} from '../types/market.types';
import { 
  getMarketData, 
  getPricePrediction, 
  subscribeToMarketData,
  getProviderHealth 
} from '../api/market';
import { useWebSocket } from './useWebSocket';

// Types for hook state and configuration
interface MarketDataState {
  data: Map<string, MarketData>;
  predictions: Map<string, PricePrediction>;
  historicalData: Map<string, HistoricalMarketData[]>;
  lastUpdate: number;
}

interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastCheck: number;
}

interface PredictionMetrics {
  symbol: string;
  accuracy: number;
  confidence: number;
  lastUpdate: number;
}

interface DataProviderConfig {
  primaryProvider?: string;
  fallbackProviders?: string[];
  updateInterval?: number;
  enablePredictions?: boolean;
  cacheTimeout?: number;
}

const DEFAULT_CONFIG: DataProviderConfig = {
  primaryProvider: 'default',
  fallbackProviders: [],
  updateInterval: 5000,
  enablePredictions: true,
  cacheTimeout: 30000
};

/**
 * Custom hook for managing real-time cryptocurrency market data
 * @param symbols Array of cryptocurrency symbols to track
 * @param interval Data aggregation interval
 * @param config Provider configuration options
 */
export function useMarketData(
  symbols: string[],
  interval: MarketDataInterval = '1m',
  config: DataProviderConfig = DEFAULT_CONFIG
) {
  // State management
  const [state, setState] = useState<MarketDataState>({
    data: new Map(),
    predictions: new Map(),
    historicalData: new Map(),
    lastUpdate: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [predictionMetrics, setPredictionMetrics] = useState<PredictionMetrics[]>([]);

  // Refs for cleanup and debouncing
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // WebSocket connection for real-time updates
  const { 
    isConnected, 
    sendMessage, 
    lastMessage, 
    connectionState,
    error: wsError 
  } = useWebSocket<MarketData>(
    symbols.map(s => `market:${s}`),
    {
      autoReconnect: true,
      heartbeatEnabled: true,
      compression: true
    }
  );

  /**
   * Fetches initial market data and sets up real-time updates
   */
  const initializeMarketData = useCallback(async () => {
    try {
      setLoading(true);
      abortControllerRef.current = new AbortController();

      // Fetch initial market data
      const marketData = await getMarketData(symbols);
      const initialData = new Map(marketData.map(data => [data.symbol, data]));

      // Fetch predictions if enabled
      let predictions = new Map<string, PricePrediction>();
      if (config.enablePredictions) {
        await Promise.all(
          symbols.map(async symbol => {
            try {
              const prediction = await getPricePrediction(symbol);
              predictions.set(symbol, prediction);
            } catch (err) {
              console.warn(`Failed to fetch prediction for ${symbol}:`, err);
            }
          })
        );
      }

      // Update state with initial data
      setState(prev => ({
        ...prev,
        data: initialData,
        predictions,
        lastUpdate: Date.now()
      }));

      // Check provider health
      const healthStatus = await getProviderHealth();
      setProviderHealth(healthStatus);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch market data'));
    } finally {
      setLoading(false);
    }
  }, [symbols, config.enablePredictions]);

  /**
   * Handles real-time market data updates
   */
  const handleMarketUpdate = useCallback((update: MarketData) => {
    setState(prev => {
      const newData = new Map(prev.data);
      newData.set(update.symbol, update);
      return {
        ...prev,
        data: newData,
        lastUpdate: Date.now()
      };
    });
  }, []);

  /**
   * Updates prediction metrics based on actual vs predicted prices
   */
  const updatePredictionMetrics = useCallback(() => {
    setState(prev => {
      const metrics: PredictionMetrics[] = [];
      prev.predictions.forEach((prediction, symbol) => {
        const currentPrice = prev.data.get(symbol)?.price;
        if (currentPrice && prediction.predicted_price) {
          const accuracy = calculatePredictionAccuracy(
            currentPrice,
            prediction.predicted_price
          );
          metrics.push({
            symbol,
            accuracy,
            confidence: prediction.model_confidence,
            lastUpdate: Date.now()
          });
        }
      });
      setPredictionMetrics(metrics);
      return prev;
    });
  }, []);

  /**
   * Calculates prediction accuracy as a percentage
   */
  const calculatePredictionAccuracy = (actual: number, predicted: number): number => {
    const difference = Math.abs(actual - predicted);
    return Math.max(0, 100 - (difference / actual) * 100);
  };

  /**
   * Manually refreshes market data
   */
  const refresh = useCallback(async () => {
    try {
      await initializeMarketData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh market data'));
    }
  }, [initializeMarketData]);

  // Initialize market data on mount
  useEffect(() => {
    initializeMarketData();

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, [initializeMarketData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.data) {
      handleMarketUpdate(lastMessage.data);
    }
  }, [lastMessage, handleMarketUpdate]);

  // Update prediction metrics periodically
  useEffect(() => {
    if (config.enablePredictions) {
      const interval = setInterval(updatePredictionMetrics, 60000);
      return () => clearInterval(interval);
    }
  }, [config.enablePredictions, updatePredictionMetrics]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      console.error('WebSocket error:', wsError);
      setError(new Error(`WebSocket connection error: ${wsError.message}`));
    }
  }, [wsError]);

  return {
    marketData: Array.from(state.data.values()),
    predictions: Array.from(state.predictions.values()),
    predictionMetrics,
    loading,
    error,
    providerHealth,
    refresh,
    connectionState,
    lastUpdate: state.lastUpdate
  };
}

export type { 
  MarketData,
  PricePrediction,
  ProviderHealth,
  PredictionMetrics,
  DataProviderConfig
};