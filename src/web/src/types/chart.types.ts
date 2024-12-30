/**
 * @fileoverview TypeScript type definitions and interfaces for chart components used in market data 
 * visualization, portfolio analytics, and educational content charts.
 * @version 1.0.0
 */

import { ChartConfiguration, ChartData, ChartOptions as ChartJsOptions } from 'chart.js'; // ^4.0.0
import { Theme } from './common.types';

/**
 * Interface representing a single data point in time series charts
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  label: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for gradient backgrounds in charts
 */
export interface GradientConfig {
  startColor: string;
  endColor: string;
  opacity?: number;
}

/**
 * Extended Chart.js plugin options with custom configurations
 */
export interface ChartPluginOptions {
  legend: {
    display: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
    align: 'start' | 'center' | 'end';
    labels: {
      usePointStyle: boolean;
      padding: number;
    };
  };
  tooltip: {
    enabled: boolean;
    mode: 'index' | 'point' | 'nearest';
    intersect: boolean;
    position: 'average' | 'nearest';
  };
}

/**
 * Configuration for chart scales
 */
export interface ChartScaleOptions {
  x: {
    type: 'linear' | 'time' | 'category';
    display: boolean;
    grid: {
      display: boolean;
      color: string;
    };
    ticks: {
      autoSkip: boolean;
      maxRotation: number;
    };
  };
  y: {
    type: 'linear' | 'logarithmic';
    display: boolean;
    beginAtZero: boolean;
    grid: {
      display: boolean;
      color: string;
    };
  };
}

/**
 * Configuration for chart animations
 */
export interface ChartAnimationOptions {
  duration: number;
  easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad';
  delay: number;
  loop: boolean;
}

/**
 * Configuration for chart accessibility features
 */
export interface ChartAccessibilityOptions {
  enabled: boolean;
  description: string;
  announceNewData: boolean;
  fallbackText: string;
}

/**
 * Configuration for chart localization
 */
export interface ChartLocalizationOptions {
  locale: string;
  numberFormat: Intl.NumberFormatOptions;
  dateFormat: Intl.DateTimeFormatOptions;
}

/**
 * Configuration for chart performance optimization
 */
export interface ChartPerformanceOptions {
  debounceDelay: number;
  throttleDelay: number;
  maxDataPoints: number;
  enableWebGL: boolean;
}

/**
 * Extended Chart.js options interface with custom configurations
 */
export interface ChartOptions extends ChartJsOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: ChartPluginOptions;
  scales: ChartScaleOptions;
  animations: ChartAnimationOptions;
  accessibility: ChartAccessibilityOptions;
  localization: ChartLocalizationOptions;
  performance: ChartPerformanceOptions;
}

/**
 * Interface for chart theme configuration
 */
export interface ChartTheme {
  backgroundColor: string | GradientConfig;
  borderColor: string;
  gridColor: string;
  textColor: string;
  contrastRatio: number;
  direction: 'ltr' | 'rtl';
}

/**
 * Enum for chart time interval options
 */
export enum ChartInterval {
  FIFTEEN_MINUTES = 900000, // 15 minutes in milliseconds
  ONE_HOUR = 3600000,
  FOUR_HOURS = 14400000,
  ONE_DAY = 86400000,
  ONE_WEEK = 604800000,
  ONE_MONTH = 2592000000
}

/**
 * Enum for available chart types
 */
export enum ChartType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  CANDLESTICK = 'candlestick',
  PIE = 'pie',
  SCATTER = 'scatter'
}

/**
 * Type for chart dataset configuration
 */
export interface ChartDataset {
  label: string;
  data: TimeSeriesDataPoint[];
  borderColor?: string;
  backgroundColor?: string | GradientConfig;
  borderWidth?: number;
  pointRadius?: number;
  tension?: number;
  fill?: boolean;
}

/**
 * Type for complete chart configuration
 */
export interface ChartConfig {
  type: ChartType;
  data: ChartDataset[];
  options: ChartOptions;
  theme?: ChartTheme;
  interval?: ChartInterval;
}

/**
 * Type for chart update configuration
 */
export interface ChartUpdateConfig {
  duration?: number;
  easing?: string;
  lazy?: boolean;
  preservation?: boolean;
}

/**
 * Type guard to check if a value is a valid ChartType
 */
export function isChartType(value: string): value is ChartType {
  return Object.values(ChartType).includes(value as ChartType);
}

/**
 * Type guard to check if a value is a valid ChartInterval
 */
export function isChartInterval(value: number): value is ChartInterval {
  return Object.values(ChartInterval).includes(value);
}