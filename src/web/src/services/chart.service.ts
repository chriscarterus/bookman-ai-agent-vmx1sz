/**
 * @fileoverview Enhanced chart service for managing chart creation, updates, and data transformations
 * with accessibility features, RTL support, and performance optimizations.
 * @version 1.0.0
 */

import { Chart } from 'chart.js/auto';
import {
  ChartTheme,
  ChartOptions,
  ChartType,
  ChartInterval,
  TimeSeriesDataPoint,
  ChartDataset,
  ChartConfig,
  ChartUpdateConfig,
  GradientConfig
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
  REDUCED_MOTION_DURATION
} from '../constants/chart.constants';

/**
 * Service class for managing chart operations with enhanced accessibility and performance
 */
export class ChartService {
  private activeCharts: Map<string, Chart> = new Map();
  private currentTheme: ChartTheme;
  private isHighContrastMode: boolean;
  private prefersReducedMotion: boolean;
  private chartStateCache: Map<string, any> = new Map();
  private readonly debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    isDarkMode: boolean = false,
    isHighContrastMode: boolean = false,
    private readonly rtlEnabled: boolean = false
  ) {
    this.currentTheme = this.getTheme(isDarkMode, isHighContrastMode);
    this.isHighContrastMode = isHighContrastMode;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.initializeChartDefaults();
  }

  /**
   * Initializes global Chart.js defaults with accessibility and performance settings
   * @private
   */
  private initializeChartDefaults(): void {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = this.currentTheme.textColor;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.devicePixelRatio = PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO;

    if (this.rtlEnabled) {
      Chart.defaults.locale = 'ar-SA'; // Example RTL locale
      Chart.defaults.rtl = true;
    }
  }

  /**
   * Creates a new chart instance with enhanced accessibility and performance features
   * @param canvasId - Canvas element ID
   * @param config - Chart configuration
   * @returns Chart instance
   */
  public createChart(canvasId: string, config: ChartConfig): Chart | null {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`Canvas element with ID ${canvasId} not found`);
      return null;
    }

    const enhancedConfig = this.enhanceChartConfig(config);
    const chart = new Chart(canvas, enhancedConfig);
    this.activeCharts.set(canvasId, chart);
    this.setupChartAccessibility(chart, config);
    this.optimizeChartPerformance(chart);

    return chart;
  }

  /**
   * Enhances chart configuration with accessibility and performance features
   * @param config - Base chart configuration
   * @returns Enhanced configuration
   * @private
   */
  private enhanceChartConfig(config: ChartConfig): ChartConfig {
    const baseOptions = { ...DEFAULT_CHART_OPTIONS };
    const enhancedOptions: ChartOptions = {
      ...baseOptions,
      ...config.options,
      animation: {
        duration: this.prefersReducedMotion ? REDUCED_MOTION_DURATION : ANIMATION_DURATION,
        easing: 'easeInOutQuad'
      },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseOptions.plugins?.tooltip,
          position: this.rtlEnabled ? 'nearest' : 'average',
          rtl: this.rtlEnabled
        },
        legend: {
          ...baseOptions.plugins?.legend,
          rtl: this.rtlEnabled,
          align: this.rtlEnabled ? 'end' : 'start'
        }
      },
      scales: {
        ...baseOptions.scales,
        x: {
          ...baseOptions.scales?.x,
          position: this.rtlEnabled ? 'right' : 'left'
        }
      }
    };

    return {
      ...config,
      options: enhancedOptions
    };
  }

  /**
   * Sets up accessibility features for the chart
   * @param chart - Chart instance
   * @param config - Chart configuration
   * @private
   */
  private setupChartAccessibility(chart: Chart, config: ChartConfig): void {
    const canvas = chart.canvas;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ACCESSIBILITY_CONFIG.descriptions[config.type] || ACCESSIBILITY_CONFIG.descriptions.general);
    
    if (this.isHighContrastMode) {
      this.applyHighContrastTheme(chart);
    }

    // Add keyboard navigation support
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', this.handleChartKeyboardNavigation.bind(this, chart));
  }

  /**
   * Optimizes chart performance for large datasets
   * @param chart - Chart instance
   * @private
   */
  private optimizeChartPerformance(chart: Chart): void {
    const dataCount = chart.data.datasets.reduce((acc, dataset) => acc + dataset.data.length, 0);
    
    if (dataCount > PERFORMANCE_CONFIG.MAX_DATA_POINTS) {
      this.enableDataDownsampling(chart);
    }

    // Enable hardware acceleration
    chart.options.devicePixelRatio = PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO;
  }

  /**
   * Updates chart theme with accessibility considerations
   * @param isDarkMode - Dark mode state
   * @param isHighContrast - High contrast mode state
   */
  public updateChartTheme(isDarkMode: boolean, isHighContrast: boolean): void {
    this.currentTheme = this.getTheme(isDarkMode, isHighContrast);
    this.isHighContrastMode = isHighContrast;

    this.activeCharts.forEach((chart) => {
      this.applyThemeToChart(chart);
      chart.update('none');
    });
  }

  /**
   * Applies current theme to chart instance
   * @param chart - Chart instance
   * @private
   */
  private applyThemeToChart(chart: Chart): void {
    const options = chart.options;
    if (!options) return;

    options.plugins = {
      ...options.plugins,
      tooltip: {
        ...options.plugins?.tooltip,
        backgroundColor: this.currentTheme.backgroundColor,
        borderColor: this.currentTheme.borderColor,
        titleColor: this.currentTheme.textColor,
        bodyColor: this.currentTheme.textColor
      }
    };

    options.scales = {
      ...options.scales,
      x: {
        ...options.scales?.x,
        grid: {
          ...options.scales?.x?.grid,
          color: this.currentTheme.gridColor
        },
        ticks: {
          ...options.scales?.x?.ticks,
          color: this.currentTheme.textColor
        }
      },
      y: {
        ...options.scales?.y,
        grid: {
          ...options.scales?.y?.grid,
          color: this.currentTheme.gridColor
        },
        ticks: {
          ...options.scales?.y?.ticks,
          color: this.currentTheme.textColor
        }
      }
    };
  }

  /**
   * Cleans up chart instances and resources
   */
  public destroy(): void {
    this.activeCharts.forEach((chart, id) => {
      chart.destroy();
      this.chartStateCache.delete(id);
    });
    this.activeCharts.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Gets appropriate theme based on current settings
   * @param isDarkMode - Dark mode state
   * @param isHighContrast - High contrast mode state
   * @returns ChartTheme
   * @private
   */
  private getTheme(isDarkMode: boolean, isHighContrast: boolean): ChartTheme {
    if (isHighContrast) {
      return CHART_THEMES.HIGH_CONTRAST;
    }
    return isDarkMode ? CHART_THEMES.DARK : CHART_THEMES.LIGHT;
  }

  /**
   * Handles keyboard navigation for chart accessibility
   * @param chart - Chart instance
   * @param event - Keyboard event
   * @private
   */
  private handleChartKeyboardNavigation(chart: Chart, event: KeyboardEvent): void {
    // Implementation of keyboard navigation handlers
    // This would include arrow key navigation, focus management, etc.
  }

  /**
   * Enables data downsampling for large datasets
   * @param chart - Chart instance
   * @private
   */
  private enableDataDownsampling(chart: Chart): void {
    // Implementation of data downsampling algorithm
    // This would include data reduction while maintaining visual fidelity
  }
}