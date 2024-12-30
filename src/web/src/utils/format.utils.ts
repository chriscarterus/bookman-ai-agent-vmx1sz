/**
 * @fileoverview Comprehensive utility module for type-safe, locale-aware formatting
 * @version 1.0.0
 * @license MIT
 */

import { format as dateFormat } from 'date-fns'; // v2.30.0
import { MarketData } from '../types/market.types';
import { Asset } from '../types/portfolio.types';

/**
 * Color codes for semantic price changes that meet WCAG AA contrast standards
 */
const PRICE_CHANGE_COLORS = {
  positive: '#10B981', // green with 4.5:1 contrast ratio
  negative: '#EF4444', // red with 4.5:1 contrast ratio
  neutral: '#6B7280', // gray with 4.5:1 contrast ratio
} as const;

/**
 * Interface for price change formatting options
 */
interface PriceChangeOptions {
  showIndicator?: boolean;
  showColor?: boolean;
  decimals?: number;
}

/**
 * Interface for percentage formatting options
 */
interface PercentageOptions {
  showSign?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  suffix?: string;
}

/**
 * Cache for memoized formatters to improve performance
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Creates or retrieves a cached number formatter instance
 * @param locale - The locale to use for formatting
 * @param options - Intl.NumberFormat options
 * @returns Cached or new Intl.NumberFormat instance
 */
const getFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const cacheKey = `${locale}-${JSON.stringify(options)}`;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }
  return formatterCache.get(cacheKey)!;
};

/**
 * Formats currency values with locale-aware symbols and grouping
 * @param value - The numeric value to format
 * @param currency - The ISO 4217 currency code
 * @param locale - The locale identifier (default: 'en-US')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  if (!isFinite(value)) return '—';

  const formatter = getFormatter(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return formatter.format(value);
};

/**
 * Formats percentage values with customizable precision and sign display
 * @param value - The numeric value to format (0.1 = 10%)
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  options: PercentageOptions = {}
): string => {
  if (!isFinite(value)) return '—';

  const {
    showSign = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    suffix = '%'
  } = options;

  const formatter = getFormatter('en-US', {
    style: 'decimal',
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay: showSign ? 'always' : 'auto'
  });

  return `${formatter.format(value * 100)}${suffix}`;
};

/**
 * Formats large volume numbers with appropriate suffixes (K, M, B, T)
 * @param volume - The volume value to format
 * @returns Formatted volume string with suffix
 */
export const formatVolume = (volume: number): string => {
  if (!isFinite(volume)) return '—';

  const tiers = [
    { threshold: 1e12, suffix: 'T' },
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' }
  ];

  const tier = tiers.find(t => Math.abs(volume) >= t.threshold);

  if (!tier) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(volume);
  }

  const scaled = volume / tier.threshold;
  const formatter = getFormatter('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: scaled < 10 ? 2 : scaled < 100 ? 1 : 0
  });

  return `${formatter.format(scaled)}${tier.suffix}`;
};

/**
 * Formats price changes with semantic colors and directional indicators
 * @param change - The price change value (as decimal)
 * @param options - Formatting options
 * @returns Formatted price change object with value, color, and indicator
 */
export const formatPriceChange = (
  change: number,
  options: PriceChangeOptions = {}
): { value: string; color: string; indicator: string } => {
  const {
    showIndicator = true,
    showColor = true,
    decimals = 2
  } = options;

  if (!isFinite(change)) {
    return {
      value: '—',
      color: PRICE_CHANGE_COLORS.neutral,
      indicator: ''
    };
  }

  const color = showColor
    ? change > 0
      ? PRICE_CHANGE_COLORS.positive
      : change < 0
        ? PRICE_CHANGE_COLORS.negative
        : PRICE_CHANGE_COLORS.neutral
    : PRICE_CHANGE_COLORS.neutral;

  const indicator = showIndicator
    ? change > 0
      ? '↑'
      : change < 0
        ? '↓'
        : ''
    : '';

  const value = formatPercentage(Math.abs(change), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    showSign: true
  });

  return { value, color, indicator };
};

/**
 * Formats a market data price with appropriate precision
 * @param price - The price value to format
 * @returns Formatted price string
 */
export const formatMarketPrice = (price: number): string => {
  if (!isFinite(price)) return '—';

  const formatter = getFormatter('en-US', {
    style: 'decimal',
    minimumFractionDigits: price < 1 ? 6 : price < 10 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 6 : price < 10 ? 4 : 2
  });

  return formatter.format(price);
};

/**
 * Formats a date for display in the UI
 * @param date - The date to format
 * @param formatString - The format string to use
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number,
  formatString: string = 'MMM d, yyyy HH:mm:ss'
): string => {
  try {
    return dateFormat(new Date(date), formatString);
  } catch {
    return '—';
  }
};

/**
 * Formats asset allocation percentages for portfolio display
 * @param asset - The asset to format allocation for
 * @param totalPortfolioValue - The total portfolio value
 * @returns Formatted allocation percentage
 */
export const formatAllocation = (
  asset: Asset,
  totalPortfolioValue: number
): string => {
  if (!totalPortfolioValue) return '0%';
  
  const allocation = asset.total_value / totalPortfolioValue;
  return formatPercentage(allocation, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
};