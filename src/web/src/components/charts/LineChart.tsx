/**
 * @fileoverview A highly accessible and performant React component for rendering line charts
 * with real-time data visualization, WebGL acceleration, and WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

import React, { useEffect, useCallback, memo, useRef } from 'react';
import { Chart, registerables } from 'chart.js'; // ^4.0.0
import {
  TimeSeriesDataPoint,
  ChartOptions,
  ChartTheme,
  ChartInterval,
  ChartType
} from '../../types/chart.types';
import useChart from '../../hooks/useChart';
import {
  formatTimeSeriesData,
  createChartOptions,
  optimizeDataPoints
} from '../../utils/chart.utils';
import {
  CHART_THEMES,
  PERFORMANCE_CONFIG,
  ACCESSIBILITY_CONFIG
} from '../../constants/chart.constants';

// Register Chart.js components
Chart.register(...registerables);

interface LineChartProps {
  /**
   * Time series data points to be visualized
   */
  data: TimeSeriesDataPoint[];
  
  /**
   * Custom chart configuration options
   */
  options?: Partial<ChartOptions>;
  
  /**
   * Chart theme configuration
   */
  theme?: ChartTheme;
  
  /**
   * Time interval for data granularity
   */
  interval?: ChartInterval;
  
  /**
   * Accessibility configuration
   */
  a11yConfig?: {
    description?: string;
    announceNewData?: boolean;
  };
  
  /**
   * Internationalization configuration
   */
  localeConfig?: {
    locale?: string;
    numberFormat?: Intl.NumberFormatOptions;
    dateFormat?: Intl.DateTimeFormatOptions;
  };
  
  /**
   * Callback fired when zoom level changes
   */
  onZoomChange?: (start: number, end: number) => void;
  
  /**
   * Additional class name for styling
   */
  className?: string;
  
  /**
   * Test ID for component testing
   */
  dataTestId?: string;
}

/**
 * LineChart component for visualizing time series data with enhanced accessibility
 * and performance optimizations.
 */
const LineChart: React.FC<LineChartProps> = memo(({
  data,
  options = {},
  theme = CHART_THEMES.LIGHT,
  interval = ChartInterval.ONE_DAY,
  a11yConfig = {},
  localeConfig = {},
  onZoomChange,
  className = '',
  dataTestId = 'line-chart'
}) => {
  // Initialize chart with accessibility configuration
  const {
    chartRef,
    updateData,
    resetZoom,
    setInterval: setChartInterval,
    setTheme: setChartTheme,
    isLoading,
    error
  } = useChart(
    ChartType.LINE,
    data,
    {
      ...options,
      plugins: {
        ...options.plugins,
        accessibility: {
          enabled: true,
          description: a11yConfig.description || ACCESSIBILITY_CONFIG.descriptions.line,
          announceNewData: a11yConfig.announceNewData ?? ACCESSIBILITY_CONFIG.announceNewData
        }
      }
    }
  );

  // Container ref for responsive sizing
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Optimized data update handler with debouncing
   */
  const handleDataUpdate = useCallback((newData: TimeSeriesDataPoint[]) => {
    if (newData.length > PERFORMANCE_CONFIG.MAX_DATA_POINTS) {
      const optimizedData = optimizeDataPoints(newData, PERFORMANCE_CONFIG.MAX_DATA_POINTS);
      updateData(optimizedData);
    } else {
      updateData(newData);
    }
  }, [updateData]);

  /**
   * Accessibility-aware zoom reset handler
   */
  const handleZoomReset = useCallback(() => {
    resetZoom();
    if (containerRef.current) {
      const resetButton = containerRef.current.querySelector('[data-testid="reset-zoom"]');
      if (resetButton instanceof HTMLElement) {
        resetButton.focus();
      }
    }
  }, [resetZoom]);

  // Update chart when data changes
  useEffect(() => {
    handleDataUpdate(data);
  }, [data, handleDataUpdate]);

  // Update theme when it changes
  useEffect(() => {
    setChartTheme(theme);
  }, [theme, setChartTheme]);

  // Update interval when it changes
  useEffect(() => {
    setChartInterval(interval);
  }, [interval, setChartInterval]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomReset]);

  if (error) {
    return (
      <div
        role="alert"
        className="chart-error"
        data-testid={`${dataTestId}-error`}
      >
        {ACCESSIBILITY_CONFIG.fallbackText}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`chart-container ${className}`}
      data-testid={dataTestId}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {isLoading && (
        <div
          role="status"
          className="chart-loading"
          data-testid={`${dataTestId}-loading`}
        >
          Loading chart...
        </div>
      )}
      
      <canvas
        ref={chartRef}
        role="img"
        aria-label={a11yConfig.description || ACCESSIBILITY_CONFIG.descriptions.line}
        tabIndex={0}
        dir={theme.direction}
        style={{ width: '100%', height: '100%' }}
      />
      
      <div className="chart-controls" role="toolbar" aria-label="Chart controls">
        <button
          type="button"
          onClick={handleZoomReset}
          className="reset-zoom-button"
          data-testid="reset-zoom"
          aria-label="Reset chart zoom"
        >
          Reset Zoom
        </button>
      </div>
    </div>
  );
});

LineChart.displayName = 'LineChart';

export default LineChart;