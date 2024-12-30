/**
 * @fileoverview Comprehensive date utility functions for consistent date handling
 * across the Bookman AI platform with support for internationalization and timezones.
 * @version 1.0.0
 * @package date-fns ^2.30.0
 */

import {
  format,
  formatDistance,
  formatRelative,
  parseISO,
  isValid,
  differenceInSeconds,
  addDays,
} from 'date-fns';

// Default format strings for consistent date display
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DEFAULT_MARKET_DATE_FORMAT = 'MMM dd, yyyy HH:mm';
const SAME_DAY_MARKET_FORMAT = 'HH:mm';

// Type definitions for function parameters
interface DateFormatOptions {
  timezone?: string;
  locale?: Locale;
  fallback?: string;
}

interface TimeRangeOptions extends DateFormatOptions {
  showSeconds?: boolean;
  condenseSameDay?: boolean;
}

interface DateRangeOptions {
  timezone?: string;
  endDate?: Date;
}

type DateRangeResult = {
  startDate: Date;
  endDate: Date;
  interval: string;
};

/**
 * Formats a date string or Date object into a standardized display format
 * with support for timezone and locale preferences.
 *
 * @param date - Date to format (string or Date object)
 * @param formatString - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @param options - Optional configuration for timezone and locale
 * @returns Formatted date string or fallback value if date is invalid
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DEFAULT_DATE_FORMAT,
  options: DateFormatOptions = {}
): string => {
  try {
    if (!date) {
      return options.fallback || '';
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return options.fallback || '';
    }

    // Apply timezone offset if specified
    let finalDate = dateObj;
    if (options.timezone) {
      const tzOffset = new Date().getTimezoneOffset() * 60000;
      finalDate = new Date(dateObj.getTime() + tzOffset);
    }

    return format(finalDate, formatString, {
      locale: options.locale,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return options.fallback || '';
  }
};

/**
 * Formats a date relative to current time with intelligent fallbacks
 * and locale support for activity feeds and transaction history.
 *
 * @param date - Date to format relative to now
 * @param options - Optional configuration for formatting
 * @returns Locale-aware relative time string
 */
export const formatRelativeTime = (
  date: Date | string,
  options: DateFormatOptions = {}
): string => {
  try {
    if (!date) {
      return options.fallback || '';
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return options.fallback || '';
    }

    const now = new Date();
    const diffInSeconds = differenceInSeconds(now, dateObj);

    // Use different formatting strategies based on time difference
    if (diffInSeconds < 60) {
      return 'just now';
    }

    return formatDistance(dateObj, now, {
      addSuffix: true,
      locale: options.locale,
    });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return options.fallback || '';
  }
};

/**
 * Formats time range for market data display with timezone awareness
 * and special handling for same-day ranges.
 *
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param options - Optional configuration for formatting
 * @returns Formatted time range string
 */
export const formatMarketTimeRange = (
  startDate: Date,
  endDate: Date,
  options: TimeRangeOptions = {}
): string => {
  try {
    if (!isValid(startDate) || !isValid(endDate)) {
      return options.fallback || '';
    }

    if (endDate < startDate) {
      throw new Error('End date cannot be before start date');
    }

    const isSameDay = startDate.toDateString() === endDate.toDateString();
    const formatStr = options.showSeconds ? 
      `${DEFAULT_MARKET_DATE_FORMAT}:ss` : 
      DEFAULT_MARKET_DATE_FORMAT;

    if (isSameDay && options.condenseSameDay) {
      return `${formatDate(startDate, formatStr, options)} - ${
        formatDate(endDate, SAME_DAY_MARKET_FORMAT, options)
      }`;
    }

    return `${formatDate(startDate, formatStr, options)} - ${
      formatDate(endDate, formatStr, options)
    }`;
  } catch (error) {
    console.error('Error formatting market time range:', error);
    return options.fallback || '';
  }
};

/**
 * Validates if a given date string or object is valid with comprehensive checks
 * for data integrity in market analysis and portfolio tracking.
 *
 * @param date - Date to validate
 * @returns Boolean indicating date validity
 */
export const isValidDate = (date: Date | string): boolean => {
  try {
    if (!date) {
      return false;
    }

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return false;
    }

    // Additional validation for reasonable date range
    const now = new Date();
    const minDate = new Date('2009-01-03'); // Bitcoin genesis date
    const maxDate = addDays(now, 1); // Allow up to 1 day in future for different timezones

    return dateObj >= minDate && dateObj <= maxDate;
  } catch (error) {
    console.error('Error validating date:', error);
    return false;
  }
};

/**
 * Calculates date range for market data queries with appropriate interval
 * determination based on range size.
 *
 * @param range - Range specification (e.g., '1d', '7d', '1m', '1y')
 * @param options - Optional configuration for range calculation
 * @returns Object containing start date, end date, and recommended data interval
 */
export const getDateRange = (
  range: string,
  options: DateRangeOptions = {}
): DateRangeResult => {
  try {
    const rangeRegex = /^(\d+)([dhmwy])$/;
    const matches = range.match(rangeRegex);

    if (!matches) {
      throw new Error('Invalid range format');
    }

    const [, value, unit] = matches;
    const amount = parseInt(value, 10);

    const endDate = options.endDate || new Date();
    let startDate: Date;
    let interval: string;

    // Calculate start date and determine appropriate interval
    switch (unit) {
      case 'd': // days
        startDate = addDays(endDate, -amount);
        interval = amount <= 7 ? '1h' : '4h';
        break;
      case 'w': // weeks
        startDate = addDays(endDate, -amount * 7);
        interval = '1d';
        break;
      case 'm': // months
        startDate = addDays(endDate, -amount * 30);
        interval = amount <= 3 ? '4h' : '1d';
        break;
      case 'y': // years
        startDate = addDays(endDate, -amount * 365);
        interval = '1d';
        break;
      default:
        throw new Error('Unsupported range unit');
    }

    return {
      startDate,
      endDate,
      interval,
    };
  } catch (error) {
    console.error('Error calculating date range:', error);
    const now = new Date();
    return {
      startDate: addDays(now, -1),
      endDate: now,
      interval: '1h',
    };
  }
};