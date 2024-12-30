/**
 * CoinDetails Component
 * @description A React component that displays detailed cryptocurrency information with
 * real-time updates, interactive charts, market analytics, and AI-powered predictions.
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Card,
  Typography,
  Grid,
  Skeleton,
  Alert,
  CircularProgress
} from '@mui/material'; // ^5.0.0

// Internal imports
import {
  MarketData,
  HistoricalMarketData,
  MarketDataInterval,
  PricePrediction,
  ProviderHealth
} from '../../types/market.types';
import { LineChart } from '../charts/LineChart';
import { useMarketData } from '../../hooks/useMarketData';

// Types
interface CoinDetailsProps {
  symbol: string;
  interval?: MarketDataInterval;
  isDarkMode?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

interface ChartData {
  timestamp: number;
  value: number;
  label: string;
}

/**
 * Enhanced CoinDetails component for displaying real-time cryptocurrency information
 */
const CoinDetails: React.FC<CoinDetailsProps> = ({
  symbol,
  interval = '1h',
  isDarkMode = false,
  className = '',
  onError
}) => {
  // State management
  const [selectedTimeframe, setSelectedTimeframe] = useState<MarketDataInterval>(interval);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [showPredictions, setShowPredictions] = useState<boolean>(true);

  // Refs for performance optimization
  const priceRef = useRef<number | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Custom hook for market data
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading,
    error,
    providerHealth,
    refresh,
    connectionState,
    lastUpdate
  } = useMarketData([symbol], selectedTimeframe, {
    enablePredictions: true,
    updateInterval: 5000
  });

  /**
   * Formats market data for chart visualization with data point thinning
   */
  const formatMarketData = useCallback((
    data: HistoricalMarketData[],
    maxPoints: number = 1000
  ): ChartData[] => {
    if (!data?.length) return [];

    // Sort and thin data points if necessary
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const thinningFactor = Math.ceil(sortedData.length / maxPoints);
    const thinnedData = thinningFactor > 1
      ? sortedData.filter((_, index) => index % thinningFactor === 0)
      : sortedData;

    return thinnedData.map(point => ({
      timestamp: new Date(point.timestamp).getTime(),
      value: point.close,
      label: new Date(point.timestamp).toLocaleString()
    }));
  }, []);

  /**
   * Memoized chart options with theme support
   */
  const chartOptions = useMemo(() => ({
    theme: isDarkMode ? 'dark' : 'light',
    interval: selectedTimeframe,
    a11yConfig: {
      announceNewData: true,
      description: `Price chart for ${symbol} cryptocurrency`
    },
    localeConfig: {
      locale: navigator.language,
      numberFormat: {
        style: 'currency',
        currency: 'USD'
      }
    }
  }), [isDarkMode, selectedTimeframe, symbol]);

  /**
   * Handles WebSocket connection errors
   */
  const handleWebSocketError = useCallback((error: Error) => {
    console.error('WebSocket error:', error);
    onError?.(error);

    // Attempt to refresh data on connection error
    if (connectionState === 'ERROR') {
      refresh();
    }
  }, [connectionState, refresh, onError]);

  /**
   * Updates price display with animation
   */
  const updatePrice = useCallback((newPrice: number) => {
    if (priceRef.current === null) {
      priceRef.current = newPrice;
      return;
    }

    const priceDiff = newPrice - priceRef.current;
    const isIncrease = priceDiff > 0;

    // Animate price change
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    priceRef.current = newPrice;
    updateTimeoutRef.current = setTimeout(() => {
      const priceElement = document.getElementById(`${symbol}-price`);
      if (priceElement) {
        priceElement.classList.add(isIncrease ? 'price-up' : 'price-down');
        setTimeout(() => {
          priceElement.classList.remove('price-up', 'price-down');
        }, 1000);
      }
    }, 0);
  }, [symbol]);

  // Update chart data when market data changes
  useEffect(() => {
    if (marketData.length > 0) {
      const formattedData = formatMarketData(marketData as unknown as HistoricalMarketData[]);
      setChartData(formattedData);

      // Update current price
      const latestPrice = marketData[marketData.length - 1]?.price;
      if (latestPrice) {
        updatePrice(latestPrice);
      }
    }
  }, [marketData, formatMarketData, updatePrice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle errors
  useEffect(() => {
    if (error) {
      handleWebSocketError(error);
    }
  }, [error, handleWebSocketError]);

  if (loading) {
    return (
      <Card className={`coin-details-skeleton ${className}`}>
        <Skeleton variant="rectangular" height={400} />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </Card>
    );
  }

  return (
    <Card className={`coin-details ${className}`} aria-live="polite">
      {/* Provider Health Status */}
      {providerHealth.some(p => p.status !== 'healthy') && (
        <Alert severity="warning" className="provider-alert">
          Some data providers are experiencing issues. Data may be delayed.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Price Information */}
        <Grid item xs={12} md={6}>
          <Typography variant="h4" component="h2" gutterBottom>
            {symbol} Price
          </Typography>
          <Typography
            id={`${symbol}-price`}
            variant="h3"
            component="p"
            className="price"
            aria-label={`Current price for ${symbol}`}
          >
            ${priceRef.current?.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </Typography>
        </Grid>

        {/* Market Analytics */}
        <Grid item xs={12} md={6}>
          {predictions.length > 0 && showPredictions && (
            <div className="predictions">
              <Typography variant="h6" gutterBottom>
                AI Price Prediction
              </Typography>
              <Typography variant="body1">
                Predicted: ${predictions[0].predicted_price.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Confidence: {(predictions[0].model_confidence * 100).toFixed(1)}%
              </Typography>
            </div>
          )}
        </Grid>

        {/* Price Chart */}
        <Grid item xs={12}>
          <div className="chart-container" style={{ height: 400 }}>
            {connectionState === 'CONNECTED' ? (
              <LineChart
                data={chartData}
                options={chartOptions}
                className="price-chart"
                dataTestId={`${symbol}-chart`}
              />
            ) : (
              <div className="chart-loading">
                <CircularProgress />
                <Typography>Connecting to market data...</Typography>
              </div>
            )}
          </div>
        </Grid>
      </Grid>
    </Card>
  );
};

export default React.memo(CoinDetails);