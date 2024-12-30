/**
 * Watchlist Component
 * @version 1.0.0
 * @description A real-time cryptocurrency watchlist page with ML-powered predictions,
 * WebSocket updates, and comprehensive error handling.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import MarketList from '../../components/market/MarketList';
import { useMarketData } from '../../hooks/useMarketData';
import { ConnectionState } from '../../hooks/useWebSocket';
import { MarketData, PricePrediction } from '../../types/market.types';
import { Theme } from '../../types/common.types';

// Constants
const UPDATE_INTERVAL = 5000;
const DEFAULT_THEME: Theme = 'light';

interface WatchlistProps {
  className?: string;
  theme?: Theme;
}

/**
 * Error Fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <div role="alert" className="watchlist-error">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

/**
 * Watchlist component for displaying real-time cryptocurrency market data
 */
export const Watchlist: React.FC<WatchlistProps> = ({
  className = '',
  theme = DEFAULT_THEME
}) => {
  // Navigation
  const navigate = useNavigate();

  // State management
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom hook for real-time market data
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading: marketDataLoading,
    error: marketDataError,
    refresh,
    connectionState,
    lastUpdate
  } = useMarketData(watchlistSymbols, '1m', {
    enablePredictions: true,
    updateInterval: UPDATE_INTERVAL
  });

  /**
   * Loads user's watchlist symbols from local storage or API
   */
  const loadWatchlistSymbols = useCallback(async () => {
    try {
      // In a real implementation, this would fetch from an API
      const savedSymbols = localStorage.getItem('watchlistSymbols');
      const symbols = savedSymbols ? 
        JSON.parse(savedSymbols) : 
        ['BTC', 'ETH', 'BNB', 'XRP', 'ADA']; // Default symbols
      
      setWatchlistSymbols(symbols);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load watchlist'));
      setLoading(false);
    }
  }, []);

  /**
   * Handles row click navigation with error boundary
   */
  const handleRowClick = useCallback((symbol: string) => {
    try {
      navigate(`/market/analysis/${symbol}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Navigation failed'));
    }
  }, [navigate]);

  /**
   * Handles watchlist refresh with retry logic
   */
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Refresh failed'));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  /**
   * Handles WebSocket connection errors
   */
  const handleConnectionError = useCallback((wsError: Error) => {
    console.error('WebSocket error:', wsError);
    setError(wsError);

    // Implement retry logic with exponential backoff
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(() => {
      refresh();
    }, UPDATE_INTERVAL);
  }, [refresh]);

  // Initialize watchlist
  useEffect(() => {
    loadWatchlistSymbols();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [loadWatchlistSymbols]);

  // Handle WebSocket connection state changes
  useEffect(() => {
    if (connectionState === ConnectionState.ERROR) {
      handleConnectionError(new Error('WebSocket connection error'));
    }
  }, [connectionState, handleConnectionError]);

  // Render loading state
  if (loading || marketDataLoading) {
    return (
      <div className="watchlist-loading" role="status">
        <p>Loading watchlist data...</p>
      </div>
    );
  }

  // Render error state
  if (error || marketDataError) {
    const errorMessage = error?.message || marketDataError?.message;
    return (
      <div role="alert" className="watchlist-error">
        <p>Error: {errorMessage}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleRefresh}
    >
      <div 
        className={`watchlist-container ${theme} ${className}`}
        data-testid="watchlist"
      >
        <div className="watchlist-header">
          <h1>Cryptocurrency Watchlist</h1>
          <div className="connection-status">
            <span>Status: {connectionState}</span>
            <span>Last Update: {new Date(lastUpdate).toLocaleTimeString()}</span>
          </div>
        </div>

        <MarketList
          symbols={watchlistSymbols}
          onRowClick={handleRowClick}
          showPredictions={true}
          updateInterval={UPDATE_INTERVAL}
          theme={theme}
          accessibilityLevel="AA"
          className="watchlist-market-list"
        />

        {predictionMetrics && predictionMetrics.length > 0 && (
          <div className="prediction-metrics" aria-live="polite">
            <h2>Prediction Metrics</h2>
            <div className="metrics-grid">
              {predictionMetrics.map(metric => (
                <div key={metric.symbol} className="metric-card">
                  <h3>{metric.symbol}</h3>
                  <p>Accuracy: {metric.accuracy.toFixed(2)}%</p>
                  <p>Confidence: {metric.confidence.toFixed(2)}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Watchlist;