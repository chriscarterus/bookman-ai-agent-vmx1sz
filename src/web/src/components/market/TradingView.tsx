/**
 * TradingView Component
 * @description Advanced trading view interface with real-time market data, AI predictions,
 * and WebGL-accelerated rendering for cryptocurrency analysis.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Canvas } from '@react-three/fiber'; // ^8.0.0

// Internal imports
import CandlestickChart from '../charts/CandlestickChart';
import { useMarketData } from '../../hooks/useMarketData';
import { 
  MarketDataInterval, 
  HistoricalMarketData,
  PricePrediction,
  ConfidenceInterval 
} from '../../types/market.types';

// Constants
const INTERVAL_OPTIONS: MarketDataInterval[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const DEFAULT_CONFIDENCE_LEVEL = 0.95;

interface TradingViewProps {
  /** Trading symbol (e.g., BTC, ETH) */
  symbol: string;
  /** Default time interval */
  defaultInterval?: MarketDataInterval;
  /** Show AI predictions */
  showPredictions?: boolean;
  /** Show confidence intervals */
  showConfidenceIntervals?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Enhanced trading view component with WebGL acceleration and AI predictions
 */
const TradingView: React.FC<TradingViewProps> = ({
  symbol,
  defaultInterval = '1h',
  showPredictions = true,
  showConfidenceIntervals = true,
  className
}) => {
  // State management
  const [selectedInterval, setSelectedInterval] = useState<MarketDataInterval>(defaultInterval);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Market data hook with real-time updates and predictions
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading,
    error,
    connectionState,
    refresh
  } = useMarketData([symbol], selectedInterval, {
    enablePredictions: showPredictions,
    updateInterval: 5000
  });

  /**
   * Handles interval change with debounced data refresh
   */
  const handleIntervalChange = useCallback((interval: MarketDataInterval) => {
    setSelectedInterval(interval);
  }, []);

  /**
   * Updates chart dimensions on container resize
   */
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setChartDimensions({ width, height });
    }
  }, []);

  // Initialize resize observer
  useEffect(() => {
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [updateDimensions]);

  /**
   * Memoized chart options with prediction overlays
   */
  const chartOptions = useMemo(() => ({
    predictions: showPredictions ? predictions : [],
    confidenceIntervals: showConfidenceIntervals ? predictions.map(p => ({
      lower: p.confidence_interval[0],
      upper: p.confidence_interval[1],
      confidence: DEFAULT_CONFIDENCE_LEVEL
    })) : [],
    annotations: predictions.map(p => ({
      type: 'line',
      mode: 'horizontal',
      scaleID: 'y',
      value: p.predicted_price,
      borderColor: 'rgba(75, 192, 192, 0.8)',
      borderWidth: 2,
      label: {
        content: `AI Prediction: $${p.predicted_price.toFixed(2)}`,
        enabled: true
      }
    }))
  }), [predictions, showPredictions, showConfidenceIntervals]);

  /**
   * Renders interval selector controls
   */
  const renderControls = () => (
    <div className="trading-view-controls" role="toolbar" aria-label="Chart interval controls">
      {INTERVAL_OPTIONS.map(interval => (
        <button
          key={interval}
          className={classNames('interval-button', {
            'active': interval === selectedInterval
          })}
          onClick={() => handleIntervalChange(interval)}
          aria-pressed={interval === selectedInterval}
        >
          {interval}
        </button>
      ))}
    </div>
  );

  /**
   * Renders prediction metrics and confidence data
   */
  const renderMetrics = () => {
    if (!showPredictions || !predictionMetrics.length) return null;

    const currentMetrics = predictionMetrics.find(m => m.symbol === symbol);
    if (!currentMetrics) return null;

    return (
      <div className="prediction-metrics" role="complementary" aria-label="AI Prediction Metrics">
        <div className="metric">
          <span>Prediction Accuracy:</span>
          <span>{currentMetrics.accuracy.toFixed(2)}%</span>
        </div>
        <div className="metric">
          <span>Model Confidence:</span>
          <span>{currentMetrics.confidence.toFixed(2)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className={classNames('trading-view-container', className)}
      data-testid="trading-view"
    >
      {renderControls()}
      
      {error && (
        <div className="error-message" role="alert">
          {error.message}
          <button onClick={refresh} aria-label="Retry">
            Retry
          </button>
        </div>
      )}

      <div className="chart-container">
        <Canvas>
          <CandlestickChart
            data={marketData}
            interval={selectedInterval}
            isDarkMode={window.matchMedia('(prefers-color-scheme: dark)').matches}
            options={chartOptions}
            className="trading-chart"
          />
        </Canvas>
      </div>

      {renderMetrics()}

      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <span className="loading-text">Loading market data...</span>
        </div>
      )}
    </div>
  );
};

// Add display name for debugging
TradingView.displayName = 'TradingView';

export default TradingView;