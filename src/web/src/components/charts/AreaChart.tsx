/**
 * @fileoverview High-performance area chart component with WebGL support, accessibility features,
 * and real-time data visualization capabilities for cryptocurrency market data.
 * @version 1.0.0
 */

import React, { memo, useEffect, useMemo, useCallback, useRef } from 'react';
import { Chart, AreaController, LinearScale, TimeScale, plugin_legend, plugin_tooltip } from 'chart.js'; // ^4.0.0
import {
  TimeSeriesDataPoint,
  ChartOptions,
  ChartTheme,
  ChartInterval,
  ChartAccessibilityOptions
} from '../../types/chart.types';
import {
  formatTimeSeriesData,
  createChartOptions,
  optimizeDataPoints
} from '../../utils/chart.utils';
import useChart from '../../hooks/useChart';

// Register required Chart.js components
Chart.register(AreaController, LinearScale, TimeScale, plugin_legend, plugin_tooltip);

interface AreaChartProps {
  /** Time series data points for visualization */
  data: TimeSeriesDataPoint[];
  /** Custom chart configuration options */
  options?: Partial<ChartOptions>;
  /** Time interval for data aggregation */
  interval?: ChartInterval;
  /** Dark mode toggle */
  isDarkMode?: boolean;
  /** High contrast mode toggle */
  isHighContrast?: boolean;
  /** Chart height */
  height?: string;
  /** Chart width */
  width?: string;
  /** RTL support */
  direction?: 'ltr' | 'rtl';
  /** Accessibility label */
  ariaLabel?: string;
  /** Accessibility description ID */
  ariaDescribedBy?: string;
  /** Zoom event handler */
  onZoom?: (start: number, end: number) => void;
  /** Error event handler */
  onError?: (error: Error) => void;
}

/**
 * High-performance area chart component for visualizing cryptocurrency market data
 * and portfolio value changes over time. Includes WebGL acceleration, accessibility
 * features, and real-time update capabilities.
 */
const AreaChart: React.FC<AreaChartProps> = memo(({
  data,
  options = {},
  interval = ChartInterval.ONE_DAY,
  isDarkMode = false,
  isHighContrast = false,
  height = '400px',
  width = '100%',
  direction = 'ltr',
  ariaLabel,
  ariaDescribedBy,
  onZoom,
  onError
}) => {
  // Performance optimization thresholds
  const DATA_THRESHOLD = 1000;
  const UPDATE_DEBOUNCE = 250;

  // Initialize chart with accessibility configuration
  const accessibilityConfig: ChartAccessibilityOptions = {
    enabled: true,
    description: ariaLabel || 'Cryptocurrency price trend visualization',
    announceNewData: true,
    fallbackText: 'Your browser does not support interactive charts. Please use a modern browser to view this content.'
  };

  const {
    chartRef,
    updateData,
    resetZoom,
    setInterval,
    setTheme,
    isLoading,
    error
  } = useChart('area', data, options, accessibilityConfig);

  // Memoized chart container style
  const containerStyle = useMemo(() => ({
    position: 'relative' as const,
    height,
    width,
    direction
  }), [height, width, direction]);

  // Optimized data update handler
  const handleDataUpdate = useCallback((newData: TimeSeriesDataPoint[], immediate = false) => {
    if (!newData?.length) return;

    const optimizedData = newData.length > DATA_THRESHOLD
      ? optimizeDataPoints(newData, DATA_THRESHOLD)
      : newData;

    if (immediate) {
      updateData(optimizedData);
    } else {
      const timeoutId = setTimeout(() => {
        updateData(optimizedData);
      }, UPDATE_DEBOUNCE);

      return () => clearTimeout(timeoutId);
    }
  }, [updateData]);

  // Interval change handler with accessibility announcements
  const handleIntervalChange = useCallback((newInterval: ChartInterval) => {
    setInterval(newInterval);
    const announceMessage = `Chart interval changed to ${ChartInterval[newInterval]}`;
    if (chartRef.current) {
      chartRef.current.setAttribute('aria-live', 'polite');
      chartRef.current.setAttribute('aria-atomic', 'true');
      chartRef.current.setAttribute('aria-label', `${ariaLabel} - ${announceMessage}`);
    }
  }, [setInterval, ariaLabel]);

  // Theme update effect
  useEffect(() => {
    const theme: ChartTheme = {
      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
      gridColor: isDarkMode ? '#475569' : '#f1f5f9',
      textColor: isDarkMode ? '#f8fafc' : '#1e293b',
      contrastRatio: isHighContrast ? 7 : 4.5,
      direction
    };
    setTheme(theme);
  }, [isDarkMode, isHighContrast, direction, setTheme]);

  // Data update effect
  useEffect(() => {
    handleDataUpdate(data);
  }, [data, handleDataUpdate]);

  // Error handling effect
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Zoom event handler
  const handleZoom = useCallback((e: WheelEvent) => {
    if (!chartRef.current || !onZoom) return;

    const chart = Chart.getChart(chartRef.current);
    if (!chart) return;

    const { min, max } = chart.scales.x;
    onZoom(min, max);
  }, [onZoom]);

  // Keyboard navigation setup
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleZoom);
    canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetZoom();
      }
    });

    return () => {
      canvas.removeEventListener('wheel', handleZoom);
      canvas.removeEventListener('keydown', resetZoom);
    };
  }, [handleZoom, resetZoom]);

  return (
    <div style={containerStyle}>
      <canvas
        ref={chartRef}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={0}
      />
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          Loading chart data...
        </div>
      )}
    </div>
  );
});

AreaChart.displayName = 'AreaChart';

export default AreaChart;