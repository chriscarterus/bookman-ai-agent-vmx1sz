/**
 * @fileoverview Constants and default configurations for chart components used across the application.
 * Includes theme-specific styles, animation settings, and accessibility configurations.
 * @version 1.0.0
 */

import { ChartConfiguration } from 'chart.js'; // ^4.0.0
import { ChartTheme } from '../types/chart.types';

// Animation durations with reduced motion support
export const ANIMATION_DURATION = 750;
export const TOOLTIP_ANIMATION_DURATION = 200;
export const REDUCED_MOTION_DURATION = 0;

// Font configuration
export const CHART_FONT_FAMILY = "'Inter', sans-serif";
export const CHART_FONT_SIZES = {
  SMALL: 12,
  MEDIUM: 14,
  LARGE: 16,
  TITLE: 18
};

// Accessibility constants
export const MINIMUM_CONTRAST_RATIO = 4.5;
export const HIGH_CONTRAST_RATIO = 7;

/**
 * Theme-specific chart configurations with accessibility and RTL support
 */
export const CHART_THEMES: Record<string, ChartTheme> = {
  LIGHT: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    gridColor: '#f1f5f9',
    textColor: '#1e293b',
    contrastRatio: MINIMUM_CONTRAST_RATIO,
    direction: 'ltr'
  },
  DARK: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    gridColor: '#475569',
    textColor: '#f8fafc',
    contrastRatio: MINIMUM_CONTRAST_RATIO,
    direction: 'ltr'
  },
  HIGH_CONTRAST: {
    backgroundColor: '#000000',
    borderColor: '#ffffff',
    gridColor: '#ffffff',
    textColor: '#ffffff',
    contrastRatio: HIGH_CONTRAST_RATIO,
    direction: 'ltr'
  }
};

/**
 * Color constants for different chart elements and states
 */
export const CHART_COLORS = {
  PRIMARY: '#2563eb',
  SECONDARY: '#10b981',
  SUCCESS: '#22c55e',
  DANGER: '#ef4444',
  GRADIENT: {
    PRIMARY: {
      startColor: '#2563eb',
      endColor: 'rgba(37, 99, 235, 0.1)'
    },
    SECONDARY: {
      startColor: '#10b981',
      endColor: 'rgba(16, 185, 129, 0.1)'
    }
  }
};

/**
 * Time interval constants for chart data granularity (in milliseconds)
 */
export const CHART_INTERVALS = {
  FIFTEEN_MINUTES: 900000,
  ONE_HOUR: 3600000,
  FOUR_HOURS: 14400000,
  ONE_DAY: 86400000,
  ONE_WEEK: 604800000,
  ONE_MONTH: 2592000000
};

/**
 * Performance optimization constants
 */
export const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 250,
  THROTTLE_DELAY: 100,
  MAX_DATA_POINTS: 1000,
  DEVICE_PIXEL_RATIO: window.devicePixelRatio || 1
};

/**
 * Enhanced default chart configuration with accessibility and internationalization support
 */
export const DEFAULT_CHART_OPTIONS: Partial<ChartConfiguration['options']> = {
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO,
  locale: 'en-US',

  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'center',
      labels: {
        usePointStyle: true,
        padding: 16,
        font: {
          family: CHART_FONT_FAMILY,
          size: CHART_FONT_SIZES.MEDIUM
        }
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
      animation: {
        duration: TOOLTIP_ANIMATION_DURATION
      },
      backgroundColor: CHART_THEMES.LIGHT.backgroundColor,
      titleColor: CHART_THEMES.LIGHT.textColor,
      bodyColor: CHART_THEMES.LIGHT.textColor,
      borderColor: CHART_THEMES.LIGHT.borderColor,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 4,
      titleFont: {
        family: CHART_FONT_FAMILY,
        size: CHART_FONT_SIZES.MEDIUM,
        weight: 600
      },
      bodyFont: {
        family: CHART_FONT_FAMILY,
        size: CHART_FONT_SIZES.SMALL
      }
    }
  },

  scales: {
    x: {
      grid: {
        display: true,
        drawBorder: true,
        drawOnChartArea: true,
        drawTicks: true,
        color: CHART_THEMES.LIGHT.gridColor
      },
      ticks: {
        font: {
          family: CHART_FONT_FAMILY,
          size: CHART_FONT_SIZES.SMALL
        },
        color: CHART_THEMES.LIGHT.textColor,
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 20
      }
    },
    y: {
      grid: {
        display: true,
        drawBorder: true,
        drawOnChartArea: true,
        drawTicks: true,
        color: CHART_THEMES.LIGHT.gridColor
      },
      ticks: {
        font: {
          family: CHART_FONT_FAMILY,
          size: CHART_FONT_SIZES.SMALL
        },
        color: CHART_THEMES.LIGHT.textColor,
        padding: 8
      },
      beginAtZero: true
    }
  },

  animation: {
    duration: ANIMATION_DURATION,
    easing: 'easeInOutQuad',
    delay: 0,
    loop: false,
    resize: {
      duration: ANIMATION_DURATION / 2
    }
  },

  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  },

  elements: {
    point: {
      radius: 3,
      hoverRadius: 5,
      borderWidth: 2
    },
    line: {
      tension: 0.4,
      borderWidth: 2,
      fill: false
    },
    bar: {
      borderWidth: 0
    }
  }
};

/**
 * Accessibility-enhanced chart defaults
 */
export const ACCESSIBILITY_CONFIG = {
  announceNewData: true,
  descriptions: {
    general: 'Chart displaying financial data over time',
    line: 'Line chart showing trend data',
    bar: 'Bar chart comparing values across categories',
    pie: 'Pie chart showing proportion distribution'
  },
  fallbackText: 'Your browser does not support interactive charts. Please use a modern browser to view this content.'
};

/**
 * Internationalization defaults
 */
export const CHART_LOCALIZATION = {
  numberFormat: {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  },
  dateFormat: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
};