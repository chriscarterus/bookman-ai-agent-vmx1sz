/**
 * CoinAnalysis Component
 * @version 1.0.0
 * @description A React page component that provides comprehensive cryptocurrency analysis
 * with real-time price data, technical analysis, AI-driven predictions, and accessibility features.
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  Container, 
  Grid, 
  CircularProgress, 
  Alert, 
  useTheme, 
  useMediaQuery 
} from '@mui/material'; // ^5.0.0
import { useNavigate, useLocation, useParams } from 'react-router-dom'; // ^6.0.0

// Internal imports
import CoinDetails from '../../components/market/CoinDetails';
import { 
  MarketData, 
  MarketDataInterval, 
  PricePrediction, 
  WebSocketMessage 
} from '../../types/market.types';
import { useMarketData } from '../../hooks/useMarketData';

// Types
interface CoinAnalysisProps {
  className?: string;
}

/**
 * Enhanced CoinAnalysis page component with real-time data and accessibility
 */
const CoinAnalysis: React.FC<CoinAnalysisProps> = memo(({ className = '' }) => {
  // Router hooks
  const { symbol = '' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Theme and media query hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [selectedInterval, setSelectedInterval] = useState<MarketDataInterval>('1h');
  const [error, setError] = useState<Error | null>(null);

  // Refs for performance optimization
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);

  // Market data hook with enhanced configuration
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading,
    error: marketError,
    providerHealth,
    refresh,
    connectionState,
    lastUpdate
  } = useMarketData([symbol], selectedInterval, {
    enablePredictions: true,
    updateInterval: 5000,
    primaryProvider: 'default',
    fallbackProviders: ['backup'],
    cacheTimeout: 30000
  });

  /**
   * Handles interval change with debouncing
   */
  const handleIntervalChange = useCallback((interval: MarketDataInterval) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      setSelectedInterval(interval);
      
      // Update URL query params
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('interval', interval);
      navigate({
        pathname: location.pathname,
        search: searchParams.toString()
      }, { replace: true });
    }, 300);
  }, [location, navigate]);

  /**
   * Enhanced error handling with retry logic
   */
  const handleError = useCallback((error: Error) => {
    console.error('Analysis error:', error);
    setError(error);

    // Attempt to refresh data for recoverable errors
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      setTimeout(refresh, 5000);
    }

    // Navigate away for fatal errors
    if (error.message.includes('not found')) {
      navigate('/market', { 
        replace: true,
        state: { error: 'Cryptocurrency not found' }
      });
    }
  }, [navigate, refresh]);

  /**
   * Initialize component with URL params
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const intervalParam = searchParams.get('interval') as MarketDataInterval;
    
    if (intervalParam && MARKET_DATA_INTERVALS.includes(intervalParam)) {
      setSelectedInterval(intervalParam);
    }
  }, [location]);

  /**
   * Handle market data errors
   */
  useEffect(() => {
    if (marketError) {
      handleError(marketError);
    }
  }, [marketError, handleError]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <Container className={`coin-analysis-loading ${className}`}>
        <Grid 
          container 
          justifyContent="center" 
          alignItems="center" 
          style={{ minHeight: '400px' }}
        >
          <CircularProgress 
            aria-label="Loading cryptocurrency analysis" 
            size={48} 
          />
        </Grid>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container className={`coin-analysis-error ${className}`}>
        <Alert 
          severity="error" 
          aria-live="polite"
          action={
            <button onClick={refresh} aria-label="Retry loading data">
              Retry
            </button>
          }
        >
          {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container 
      className={`coin-analysis ${className}`}
      aria-live="polite"
      aria-busy={loading}
    >
      {/* Provider Health Warning */}
      {providerHealth.some(p => p.status !== 'healthy') && (
        <Alert 
          severity="warning" 
          className="provider-alert"
          style={{ marginBottom: theme.spacing(2) }}
        >
          Some data providers are experiencing issues. Data may be delayed.
        </Alert>
      )}

      {/* Main Analysis Content */}
      <Grid container spacing={3}>
        {/* Coin Details Section */}
        <Grid item xs={12}>
          <CoinDetails
            symbol={symbol}
            interval={selectedInterval}
            isDarkMode={theme.palette.mode === 'dark'}
            onError={handleError}
            className="coin-details-section"
          />
        </Grid>

        {/* Additional Analysis Sections */}
        {!isMobile && predictions.length > 0 && (
          <Grid item xs={12}>
            <Alert 
              severity="info" 
              className="prediction-info"
              style={{ marginTop: theme.spacing(2) }}
            >
              AI Prediction Confidence: {
                (predictionMetrics[0]?.confidence * 100).toFixed(1)
              }%
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* Connection Status */}
      {connectionState !== 'CONNECTED' && (
        <Alert 
          severity="info" 
          className="connection-status"
          style={{ position: 'fixed', bottom: 16, right: 16 }}
        >
          {connectionState === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...'}
        </Alert>
      )}
    </Container>
  );
});

CoinAnalysis.displayName = 'CoinAnalysis';

export default CoinAnalysis;