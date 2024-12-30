/**
 * Market Overview Page Component
 * @description A comprehensive cryptocurrency market data overview page with real-time
 * updates, AI-powered predictions, and enhanced accessibility features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Grid,
  Card,
  Typography,
  Divider,
  Skeleton,
  Alert
} from '@mui/material';
import debounce from 'lodash/debounce'; // ^4.17.21

// Internal imports
import MarketList from '../../components/market/MarketList';
import TradingView from '../../components/market/TradingView';
import CoinDetails from '../../components/market/CoinDetails';
import { useMarketData } from '../../hooks/useMarketData';
import { MarketDataInterval } from '../../types/market.types';

// Constants
const DEFAULT_SYMBOL = 'BTC';
const DEFAULT_INTERVAL: MarketDataInterval = '1h';
const DEBOUNCE_DELAY = 300;
const TOP_CRYPTOCURRENCIES = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE'];

interface MarketOverviewProps {
  className?: string;
}

/**
 * MarketOverview component providing a comprehensive market data visualization
 * with real-time updates and AI-powered predictions.
 */
const MarketOverview: React.FC<MarketOverviewProps> = ({ className = '' }) => {
  // State management
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [selectedInterval, setSelectedInterval] = useState<MarketDataInterval>(DEFAULT_INTERVAL);
  const [showPredictions, setShowPredictions] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs for performance optimization
  const announcementRef = useRef<HTMLDivElement>(null);

  // Custom hook for market data
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading,
    error: marketError,
    connectionState,
    refresh,
    lastUpdate
  } = useMarketData(TOP_CRYPTOCURRENCIES, selectedInterval, {
    enablePredictions: showPredictions,
    updateInterval: 5000
  });

  /**
   * Handles symbol selection with debouncing and validation
   */
  const handleSymbolSelect = useCallback(
    debounce((symbol: string) => {
      if (!TOP_CRYPTOCURRENCIES.includes(symbol)) {
        setError(new Error('Invalid cryptocurrency symbol'));
        return;
      }

      setSelectedSymbol(symbol);
      
      // Update URL query parameters
      const url = new URL(window.location.href);
      url.searchParams.set('symbol', symbol);
      window.history.replaceState({}, '', url.toString());

      // Announce symbol change to screen readers
      if (announcementRef.current) {
        announcementRef.current.textContent = `Selected cryptocurrency changed to ${symbol}`;
      }
    }, DEBOUNCE_DELAY),
    []
  );

  /**
   * Handles interval change with data optimization
   */
  const handleIntervalChange = useCallback((interval: MarketDataInterval) => {
    setSelectedInterval(interval);
    
    // Announce interval change to screen readers
    if (announcementRef.current) {
      announcementRef.current.textContent = `Time interval changed to ${interval}`;
    }
  }, []);

  /**
   * Memoized market list configuration
   */
  const marketListConfig = useMemo(() => ({
    symbols: TOP_CRYPTOCURRENCIES,
    showPredictions,
    virtualScroll: true,
    accessibilityLevel: 'AA' as const
  }), [showPredictions]);

  /**
   * Memoized trading view configuration
   */
  const tradingViewConfig = useMemo(() => ({
    symbol: selectedSymbol,
    interval: selectedInterval,
    showPredictions,
    showConfidenceIntervals: true,
    webGLEnabled: true
  }), [selectedSymbol, selectedInterval, showPredictions]);

  // Initialize selected symbol from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const symbolParam = params.get('symbol');
    if (symbolParam && TOP_CRYPTOCURRENCIES.includes(symbolParam.toUpperCase())) {
      setSelectedSymbol(symbolParam.toUpperCase());
    }
  }, []);

  // Handle market data errors
  useEffect(() => {
    if (marketError) {
      setError(marketError);
    }
  }, [marketError]);

  if (loading) {
    return (
      <div className={`market-overview-loading ${className}`}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={600} />
          </Grid>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={400} />
            <Skeleton variant="text" height={100} />
          </Grid>
        </Grid>
      </div>
    );
  }

  return (
    <div className={`market-overview ${className}`}>
      {/* Accessibility announcement region */}
      <div
        ref={announcementRef}
        className="visually-hidden"
        role="status"
        aria-live="polite"
      />

      {/* Error display */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          className="market-error"
        >
          {error.message}
          <button onClick={refresh} className="retry-button">
            Retry
          </button>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Market List Section */}
        <Grid item xs={12} md={4}>
          <Card>
            <Typography variant="h6" component="h2" className="section-title">
              Top Cryptocurrencies
            </Typography>
            <Divider />
            <MarketList
              {...marketListConfig}
              onRowClick={handleSymbolSelect}
              className="market-list"
            />
          </Card>
        </Grid>

        {/* Trading View and Details Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <TradingView
              {...tradingViewConfig}
              className="trading-view"
            />
            <Divider />
            <CoinDetails
              symbol={selectedSymbol}
              interval={selectedInterval}
              isDarkMode={window.matchMedia('(prefers-color-scheme: dark)').matches}
              onError={setError}
              className="coin-details"
            />
          </Card>

          {/* Connection Status */}
          {connectionState !== 'CONNECTED' && (
            <Alert 
              severity="warning"
              className="connection-alert"
            >
              {connectionState === 'CONNECTING' ? 'Connecting to market data...' : 'Connection lost. Attempting to reconnect...'}
            </Alert>
          )}

          {/* Last Update Timestamp */}
          <Typography
            variant="caption"
            color="textSecondary"
            className="update-timestamp"
          >
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </Typography>
        </Grid>
      </Grid>
    </div>
  );
};

export default React.memo(MarketOverview);