/**
 * @fileoverview Enhanced chart configuration with accessibility, performance optimization,
 * and internationalization support for the Bookman AI platform.
 * @version 1.0.0
 */

import { Chart, ChartConfiguration } from 'chart.js'; // ^4.0.0
import {
  ChartTheme,
  ChartOptions,
  ChartType,
  ChartInterval,
  TimeSeriesDataPoint,
  ChartAccessibilityOptions,
  ChartPerformanceOptions
} from '../types/chart.types';
import {
  CHART_THEMES,
  CHART_COLORS,
  CHART_INTERVALS,
  DEFAULT_CHART_OPTIONS,
  PERFORMANCE_CONFIG,
  ACCESSIBILITY_CONFIG,
  CHART_LOCALIZATION,
  ANIMATION_DURATION,
  TOOLTIP_ANIMATION_DURATION,
  MINIMUM_CONTRAST_RATIO
} from '../constants/chart.constants';

// Performance thresholds
const PERFORMANCE_THRESHOLD = 60; // fps
const MIN_CONTRAST_RATIO = 4.5; // WCAG 2.1 AA standard

/**
 * Creates an enhanced chart configuration with theme support, accessibility features,
 * and performance optimizations.
 * @param type - The type of chart to create
 * @param options - Custom chart options
 * @param isDarkMode - Current theme mode
 * @param a11yConfig - Accessibility configuration
 * @returns Complete chart configuration
 */
export const createChartConfig = (
  type: ChartType,
  options: Partial<ChartOptions>,
  isDarkMode: boolean,
  a11yConfig?: Partial<ChartAccessibilityOptions>
): ChartConfiguration => {
  const theme = isDarkMode ? CHART_THEMES.DARK : CHART_THEMES.LIGHT;
  const baseConfig = { ...DEFAULT_CHART_OPTIONS };

  // Merge custom options with defaults
  const mergedOptions = {
    ...baseConfig,
    ...options,
    plugins: {
      ...baseConfig.plugins,
      ...options.plugins
    }
  };

  // Apply theme-specific styling
  const themedConfig = applyThemeStyling(mergedOptions, theme);

  // Enhance accessibility
  const accessibleConfig = validateChartAccessibility(themedConfig, {
    ...ACCESSIBILITY_CONFIG,
    ...a11yConfig
  });

  // Optimize performance
  const optimizedConfig = optimizeChartPerformance(accessibleConfig, options.data?.length || 0);

  return {
    type,
    ...optimizedConfig
  };
};

/**
 * Applies theme-specific styling to chart configuration
 * @param config - Base chart configuration
 * @param theme - Current theme settings
 * @returns Theme-enhanced configuration
 */
const applyThemeStyling = (
  config: Partial<ChartConfiguration>,
  theme: ChartTheme
): Partial<ChartConfiguration> => {
  return {
    ...config,
    options: {
      ...config.options,
      scales: {
        x: {
          ...config.options?.scales?.x,
          grid: {
            ...config.options?.scales?.x?.grid,
            color: theme.gridColor
          },
          ticks: {
            ...config.options?.scales?.x?.ticks,
            color: theme.textColor
          }
        },
        y: {
          ...config.options?.scales?.y,
          grid: {
            ...config.options?.scales?.y?.grid,
            color: theme.gridColor
          },
          ticks: {
            ...config.options?.scales?.y?.ticks,
            color: theme.textColor
          }
        }
      },
      plugins: {
        ...config.options?.plugins,
        tooltip: {
          ...config.options?.plugins?.tooltip,
          backgroundColor: theme.backgroundColor,
          titleColor: theme.textColor,
          bodyColor: theme.textColor,
          borderColor: theme.borderColor
        }
      }
    }
  };
};

/**
 * Validates and enhances chart accessibility features
 * @param config - Chart configuration
 * @param a11yConfig - Accessibility settings
 * @returns Accessibility-enhanced configuration
 */
export const validateChartAccessibility = (
  config: Partial<ChartConfiguration>,
  a11yConfig: Partial<ChartAccessibilityOptions>
): Partial<ChartConfiguration> => {
  return {
    ...config,
    options: {
      ...config.options,
      plugins: {
        ...config.options?.plugins,
        accessibility: {
          enabled: true,
          announceNewData: a11yConfig.announceNewData,
          description: a11yConfig.description || ACCESSIBILITY_CONFIG.descriptions.general,
          fallbackText: a11yConfig.fallbackText || ACCESSIBILITY_CONFIG.fallbackText
        }
      }
    }
  };
};

/**
 * Optimizes chart performance based on device capabilities and data size
 * @param config - Chart configuration
 * @param dataPoints - Number of data points
 * @returns Performance-optimized configuration
 */
export const optimizeChartPerformance = (
  config: Partial<ChartConfiguration>,
  dataPoints: number
): Partial<ChartConfiguration> => {
  const performanceConfig: ChartPerformanceOptions = {
    debounceDelay: PERFORMANCE_CONFIG.DEBOUNCE_DELAY,
    throttleDelay: PERFORMANCE_CONFIG.THROTTLE_DELAY,
    maxDataPoints: PERFORMANCE_CONFIG.MAX_DATA_POINTS,
    enableWebGL: dataPoints > PERFORMANCE_CONFIG.MAX_DATA_POINTS
  };

  return {
    ...config,
    options: {
      ...config.options,
      animation: {
        ...config.options?.animation,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : ANIMATION_DURATION
      },
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO,
      parsing: dataPoints > PERFORMANCE_CONFIG.MAX_DATA_POINTS ? false : undefined,
      normalized: true
    }
  };
};

/**
 * Default export of chart configuration utilities
 */
export const chartConfig = {
  createChartConfig,
  validateChartAccessibility,
  optimizeChartPerformance,
  themes: CHART_THEMES,
  colors: CHART_COLORS,
  intervals: CHART_INTERVALS,
  localization: CHART_LOCALIZATION
};

export default chartConfig;