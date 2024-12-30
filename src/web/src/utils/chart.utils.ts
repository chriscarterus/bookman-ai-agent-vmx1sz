/**
 * @fileoverview Utility functions for chart data manipulation, formatting, and configuration
 * with support for accessibility, internationalization, and performance optimizations.
 * @version 1.0.0
 */

import { Chart, ChartConfiguration, Plugin } from 'chart.js'; // ^4.0.0
import { format, formatDistance, Locale } from 'date-fns'; // ^2.30.0
import {
  TimeSeriesDataPoint,
  ChartOptions,
  ChartTheme,
  ChartInterval,
  ChartType,
  GradientConfig
} from '../types/chart.types';
import {
  CHART_THEMES,
  CHART_COLORS,
  CHART_INTERVALS,
  DEFAULT_CHART_OPTIONS,
  PERFORMANCE_CONFIG,
  ACCESSIBILITY_CONFIG,
  CHART_LOCALIZATION
} from '../constants/chart.constants';

/**
 * Formats time series data for Chart.js with optimizations for real-time updates
 * and large datasets.
 * 
 * @param data - Array of time series data points
 * @param chartType - Type of chart to format data for
 * @param locale - Locale for date/number formatting
 * @param maxPoints - Maximum number of data points before thinning
 * @returns Formatted chart data configuration
 */
export function formatTimeSeriesData(
  data: TimeSeriesDataPoint[],
  chartType: ChartType,
  locale: Locale,
  maxPoints: number = PERFORMANCE_CONFIG.MAX_DATA_POINTS
): ChartConfiguration['data'] {
  if (!data?.length) {
    return { labels: [], datasets: [] };
  }

  // Sort data by timestamp
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

  // Apply data thinning for large datasets
  const thinningFactor = Math.ceil(sortedData.length / maxPoints);
  const thinnedData = thinningFactor > 1
    ? sortedData.filter((_, index) => index % thinningFactor === 0)
    : sortedData;

  // Format timestamps based on data interval
  const interval = determineDataInterval(thinnedData);
  const labels = thinnedData.map(point => formatTimestamp(point.timestamp, interval, locale));

  // Create dataset with type-specific configuration
  const dataset = {
    label: 'Value',
    data: thinnedData.map(point => point.value),
    borderColor: CHART_COLORS.PRIMARY,
    backgroundColor: chartType === ChartType.AREA
      ? createGradient(CHART_COLORS.GRADIENT.PRIMARY)
      : CHART_COLORS.PRIMARY,
    borderWidth: 2,
    pointRadius: thinnedData.length > 100 ? 0 : 3,
    tension: 0.4,
    fill: chartType === ChartType.AREA
  };

  return {
    labels,
    datasets: [dataset]
  };
}

/**
 * Creates customized chart options with enhanced theme support and accessibility features.
 * 
 * @param chartType - Type of chart being configured
 * @param customOptions - User-provided custom options
 * @param isDarkMode - Current theme mode
 * @param isRTL - Right-to-left layout direction
 * @returns Complete chart options configuration
 */
export function createChartOptions(
  chartType: ChartType,
  customOptions: Partial<ChartOptions>,
  isDarkMode: boolean,
  isRTL: boolean
): ChartConfiguration['options'] {
  const theme = isDarkMode ? CHART_THEMES.DARK : CHART_THEMES.LIGHT;
  const baseOptions = { ...DEFAULT_CHART_OPTIONS };

  // Apply theme-specific colors
  const themedOptions = applyThemeColors(baseOptions, theme);

  // Configure RTL support
  if (isRTL) {
    themedOptions.scales = {
      ...themedOptions.scales,
      x: {
        ...themedOptions.scales?.x,
        position: 'top',
        reverse: true
      }
    };
  }

  // Add accessibility features
  const accessibilityPlugin: Plugin = {
    id: 'chartAccessibility',
    afterInit: (chart) => {
      chart.canvas.setAttribute('role', 'img');
      chart.canvas.setAttribute('aria-label', 
        ACCESSIBILITY_CONFIG.descriptions[chartType] || ACCESSIBILITY_CONFIG.descriptions.general
      );
    }
  };

  // Merge with custom options and performance optimizations
  return {
    ...themedOptions,
    ...customOptions,
    plugins: {
      ...themedOptions.plugins,
      ...customOptions.plugins,
      accessibility: {
        enabled: true,
        announceNewData: ACCESSIBILITY_CONFIG.announceNewData,
        description: ACCESSIBILITY_CONFIG.descriptions[chartType],
        fallbackText: ACCESSIBILITY_CONFIG.fallbackText
      }
    },
    devicePixelRatio: PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO,
    animation: {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : themedOptions.animation?.duration
    }
  };
}

/**
 * Formats numeric values for chart display with internationalization support.
 * 
 * @param value - Numeric value to format
 * @param format - Format type (currency, percentage, number)
 * @param locale - Locale for number formatting
 * @returns Formatted string value
 */
export function formatChartValue(
  value: number,
  format: string,
  locale: Locale
): string {
  if (typeof value !== 'number') {
    return '';
  }

  const formatOptions = {
    ...CHART_LOCALIZATION.numberFormat,
    notation: value > 1000000 ? 'compact' : 'standard' as Intl.NumberFormatOptions['notation']
  };

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale.code, {
        ...formatOptions,
        style: 'currency',
        currency: 'USD'
      }).format(value);

    case 'percentage':
      return new Intl.NumberFormat(locale.code, {
        ...formatOptions,
        style: 'percent',
        maximumFractionDigits: 1
      }).format(value / 100);

    default:
      return new Intl.NumberFormat(locale.code, formatOptions).format(value);
  }
}

/**
 * Calculates appropriate min/max values for chart axes with enhanced precision.
 * 
 * @param values - Array of numeric values
 * @param padding - Padding percentage for axis range
 * @param scaleType - Type of scale (linear/logarithmic)
 * @returns Optimized min and max values with scale configuration
 */
export function calculateChartDomain(
  values: number[],
  padding: number = 0.1,
  scaleType: 'linear' | 'logarithmic' = 'linear'
): { min: number; max: number; scale: string } {
  if (!values?.length) {
    return { min: 0, max: 0, scale: scaleType };
  }

  // Calculate base min/max
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Handle special cases
  if (range === 0) {
    return {
      min: min * 0.9,
      max: max * 1.1,
      scale: 'linear'
    };
  }

  // Determine if logarithmic scale is appropriate
  const shouldUseLog = max / Math.max(Math.abs(min), 1) > 1000;

  // Calculate padded range
  const paddedMin = min - (range * padding);
  const paddedMax = max + (range * padding);

  return {
    min: shouldUseLog ? Math.max(paddedMin, 0.1) : paddedMin,
    max: paddedMax,
    scale: shouldUseLog ? 'logarithmic' : 'linear'
  };
}

// Helper Functions

/**
 * Determines the appropriate time interval for data points.
 */
function determineDataInterval(data: TimeSeriesDataPoint[]): ChartInterval {
  if (data.length < 2) return ChartInterval.ONE_HOUR;
  
  const avgInterval = (data[data.length - 1].timestamp - data[0].timestamp) / (data.length - 1);
  
  return Object.values(CHART_INTERVALS).find(interval => avgInterval <= interval)
    || ChartInterval.ONE_DAY;
}

/**
 * Formats timestamp based on interval and locale.
 */
function formatTimestamp(
  timestamp: number,
  interval: ChartInterval,
  locale: Locale
): string {
  const date = new Date(timestamp);
  
  switch (interval) {
    case ChartInterval.FIFTEEN_MINUTES:
    case ChartInterval.ONE_HOUR:
      return format(date, 'HH:mm', { locale });
    case ChartInterval.FOUR_HOURS:
    case ChartInterval.ONE_DAY:
      return format(date, 'MMM dd HH:mm', { locale });
    case ChartInterval.ONE_WEEK:
    case ChartInterval.ONE_MONTH:
      return format(date, 'MMM dd yyyy', { locale });
    default:
      return format(date, 'MMM dd yyyy', { locale });
  }
}

/**
 * Creates a gradient configuration for chart backgrounds.
 */
function createGradient(gradientConfig: GradientConfig): CanvasGradient {
  return {
    addColorStop: (offset: number, color: string) => {
      // This is a mock implementation since actual gradients
      // need to be created with canvas context
      return { offset, color };
    }
  } as unknown as CanvasGradient;
}

/**
 * Applies theme colors to chart options.
 */
function applyThemeColors(
  options: ChartConfiguration['options'],
  theme: ChartTheme
): ChartConfiguration['options'] {
  return {
    ...options,
    scales: {
      ...options?.scales,
      x: {
        ...options?.scales?.x,
        grid: {
          ...options?.scales?.x?.grid,
          color: theme.gridColor
        },
        ticks: {
          ...options?.scales?.x?.ticks,
          color: theme.textColor
        }
      },
      y: {
        ...options?.scales?.y,
        grid: {
          ...options?.scales?.y?.grid,
          color: theme.gridColor
        },
        ticks: {
          ...options?.scales?.y?.ticks,
          color: theme.textColor
        }
      }
    }
  };
}