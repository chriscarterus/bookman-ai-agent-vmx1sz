/**
 * @fileoverview Advanced React hook for managing chart instances with enhanced accessibility,
 * performance optimization, and real-time data visualization capabilities.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  TimeSeriesDataPoint,
  ChartOptions,
  ChartTheme,
  ChartInterval,
  ChartType,
  AccessibilityConfig
} from '../types/chart.types';
import {
  formatTimeSeriesData,
  createChartOptions,
  formatChartValue,
  calculateChartDomain,
  optimizeDataPoints
} from '../utils/chart.utils';
import {
  CHART_THEMES,
  CHART_COLORS,
  CHART_INTERVALS,
  DEFAULT_CHART_OPTIONS,
  HIGH_CONTRAST_THEMES
} from '../constants/chart.constants';

// Register Chart.js components
Chart.register(...registerables);

// Constants for performance optimization
const CHART_UPDATE_DEBOUNCE = 100;
const ZOOM_ANIMATION_DURATION = 500;
const DATA_POINT_THRESHOLD = 1000;
const WEBGL_POINT_SIZE = 3;

/**
 * Advanced custom hook for managing chart instances with enhanced accessibility,
 * performance optimization, and real-time updates.
 */
export default function useChart(
  chartType: ChartType,
  initialData: TimeSeriesDataPoint[] = [],
  customOptions: Partial<ChartOptions> = {},
  accessibilityConfig: AccessibilityConfig = { enabled: true }
) {
  // Refs
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const updateTimeout = useRef<NodeJS.Timeout>();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ChartTheme>(CHART_THEMES.LIGHT);
  const [currentInterval, setCurrentInterval] = useState<ChartInterval>(CHART_INTERVALS.ONE_DAY);

  // Memoized chart options
  const chartOptions = useMemo(() => {
    const isRTL = document.dir === 'rtl';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return createChartOptions(
      chartType,
      {
        ...DEFAULT_CHART_OPTIONS,
        ...customOptions,
        animation: {
          duration: prefersReducedMotion ? 0 : ZOOM_ANIMATION_DURATION
        }
      },
      currentTheme === CHART_THEMES.DARK,
      isRTL
    );
  }, [chartType, customOptions, currentTheme]);

  /**
   * Initializes the chart instance with WebGL support and accessibility features
   */
  const initializeChart = useCallback(() => {
    if (!chartRef.current) return;

    try {
      // Clean up existing instance
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      // Check WebGL support
      const ctx = chartRef.current.getContext('2d');
      const webGLContext = chartRef.current.getContext('webgl2');
      const useWebGL = !!webGLContext && initialData.length > DATA_POINT_THRESHOLD;

      if (useWebGL) {
        // Configure WebGL context
        webGLContext!.viewport(0, 0, chartRef.current.width, chartRef.current.height);
        webGLContext!.clearColor(0, 0, 0, 0);
      }

      // Create optimized chart configuration
      const config = {
        type: chartType,
        data: formatTimeSeriesData(initialData, chartType, navigator.language),
        options: {
          ...chartOptions,
          devicePixelRatio: window.devicePixelRatio || 1,
          elements: {
            point: {
              radius: useWebGL ? WEBGL_POINT_SIZE : 3
            }
          }
        }
      };

      // Initialize chart with accessibility support
      chartInstance.current = new Chart(ctx!, config);

      // Add accessibility attributes
      if (accessibilityConfig.enabled) {
        chartRef.current.setAttribute('role', 'img');
        chartRef.current.setAttribute('aria-label', accessibilityConfig.description || '');
        chartRef.current.setAttribute('tabindex', '0');
      }

      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  }, [chartType, initialData, chartOptions, accessibilityConfig]);

  /**
   * Updates chart data with debouncing and optimization
   */
  const updateData = useCallback((newData: TimeSeriesDataPoint[]) => {
    if (!chartInstance.current) return;

    // Clear existing timeout
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }

    // Debounce updates
    updateTimeout.current = setTimeout(() => {
      try {
        const optimizedData = newData.length > DATA_POINT_THRESHOLD
          ? optimizeDataPoints(newData, DATA_POINT_THRESHOLD)
          : newData;

        chartInstance.current!.data = formatTimeSeriesData(
          optimizedData,
          chartType,
          navigator.language
        );
        chartInstance.current!.update('active');
      } catch (err) {
        setError(err as Error);
      }
    }, CHART_UPDATE_DEBOUNCE);
  }, [chartType]);

  /**
   * Resets chart zoom level with animation
   */
  const resetZoom = useCallback(() => {
    if (!chartInstance.current) return;

    chartInstance.current.resetZoom({
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  }, []);

  /**
   * Updates chart time interval
   */
  const setInterval = useCallback((interval: ChartInterval) => {
    setCurrentInterval(interval);
    if (chartInstance.current) {
      chartInstance.current.options.scales!.x!.time = {
        unit: interval
      };
      chartInstance.current.update('active');
    }
  }, []);

  /**
   * Updates chart theme with high contrast support
   */
  const setTheme = useCallback((theme: ChartTheme) => {
    setCurrentTheme(theme);
    if (chartInstance.current) {
      const isHighContrast = theme.contrastRatio >= 7;
      const themeColors = isHighContrast ? HIGH_CONTRAST_THEMES : CHART_THEMES;
      
      chartInstance.current.options.plugins!.tooltip!.backgroundColor = themeColors[theme.toString()].backgroundColor;
      chartInstance.current.options.scales!.x!.grid!.color = themeColors[theme.toString()].gridColor;
      chartInstance.current.options.scales!.y!.grid!.color = themeColors[theme.toString()].gridColor;
      chartInstance.current.update('active');
    }
  }, []);

  // Initialize chart on mount
  useEffect(() => {
    initializeChart();

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
    };
  }, [initializeChart]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    chartRef,
    updateData,
    resetZoom,
    setInterval,
    setTheme,
    isLoading,
    error
  };
}