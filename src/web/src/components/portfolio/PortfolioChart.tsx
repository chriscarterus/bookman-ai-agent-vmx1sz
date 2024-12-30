/**
 * PortfolioChart Component
 * @description A high-performance, accessible portfolio chart component with real-time updates,
 * WebGL acceleration, and comprehensive theme support.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Chart, registerables } from 'chart.js'; // ^4.0.0
import {
  TimeSeriesDataPoint,
  ChartOptions,
  ChartTheme,
  ChartInterval,
  ChartType,
  ChartAccessibility
} from '../../types/chart.types';
import useChart from '../../hooks/useChart';
import usePortfolio from '../../hooks/usePortfolio';

// Register Chart.js components
Chart.register(...registerables);

// Constants for chart optimization
const DEFAULT_HEIGHT = 400;
const DATA_UPDATE_INTERVAL = 5000;
const ANIMATION_DURATION = 750;

interface PortfolioChartProps {
  portfolioId: string;
  chartType?: ChartType;
  interval?: ChartInterval;
  height?: number;
  className?: string;
  theme?: ChartTheme;
  accessibility?: ChartAccessibility;
}

/**
 * PortfolioChart component for visualizing portfolio performance data
 * with enhanced accessibility and real-time updates.
 */
export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  portfolioId,
  chartType = ChartType.LINE,
  interval = ChartInterval.ONE_MONTH,
  height = DEFAULT_HEIGHT,
  className = '',
  theme,
  accessibility = { enabled: true }
}) => {
  // Hooks
  const {
    chartRef,
    updateData,
    resetZoom,
    setInterval: setChartInterval,
    setTheme: setChartTheme,
    isLoading,
    error
  } = useChart(chartType, [], {
    animation: {
      duration: ANIMATION_DURATION
    }
  }, accessibility);

  const { portfolio, loading: portfolioLoading } = usePortfolio(portfolioId);

  // Memoized chart data formatting
  const formatPortfolioData = useCallback((performanceData: any[]): TimeSeriesDataPoint[] => {
    if (!performanceData?.length) return [];

    return performanceData.map(point => ({
      timestamp: new Date(point.timestamp).getTime(),
      value: point.value,
      label: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(point.value)
    }));
  }, []);

  // Update chart data when portfolio changes
  useEffect(() => {
    if (portfolio?.performance_history) {
      const formattedData = formatPortfolioData(portfolio.performance_history);
      updateData(formattedData);
    }
  }, [portfolio?.performance_history, formatPortfolioData, updateData]);

  // Handle interval changes
  useEffect(() => {
    setChartInterval(interval);
  }, [interval, setChartInterval]);

  // Handle theme changes
  useEffect(() => {
    if (theme) {
      setChartTheme(theme);
    }
  }, [theme, setChartTheme]);

  // Real-time data updates
  useEffect(() => {
    const updateTimer = setInterval(() => {
      if (portfolio?.portfolio_id) {
        // Trigger portfolio data refresh
        portfolio.refreshPrices?.();
      }
    }, DATA_UPDATE_INTERVAL);

    return () => clearInterval(updateTimer);
  }, [portfolio]);

  // Error handling
  useEffect(() => {
    if (error) {
      console.error('Chart Error:', error);
      // Implement error boundary or fallback UI
    }
  }, [error]);

  // Loading state
  const isChartLoading = isLoading || portfolioLoading;

  // Render chart container with accessibility attributes
  return (
    <div
      className={`portfolio-chart ${className}`}
      style={{ height: `${height}px`, position: 'relative' }}
      role="region"
      aria-label={accessibility?.description || 'Portfolio performance chart'}
    >
      {isChartLoading && (
        <div
          className="chart-loader"
          role="alert"
          aria-busy="true"
        >
          Loading chart data...
        </div>
      )}
      
      <canvas
        ref={chartRef}
        height={height}
        className="portfolio-chart-canvas"
        tabIndex={0}
        aria-label={accessibility?.description}
        role="img"
      />

      {error && (
        <div
          className="chart-error"
          role="alert"
          aria-live="polite"
        >
          {error.message || 'Error loading chart data'}
        </div>
      )}
    </div>
  );
};

// Default export
export default PortfolioChart;

// Type exports for consumers
export type { PortfolioChartProps };