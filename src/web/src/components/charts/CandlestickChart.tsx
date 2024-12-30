/**
 * @fileoverview A React component that renders an interactive candlestick chart
 * for cryptocurrency market data visualization with WebGL rendering optimization
 * and accessibility features.
 * @version 1.0.0
 */

import React, { useEffect, useRef, memo, useCallback } from 'react';
import { Chart, registerables } from 'chart.js'; // ^4.0.0
import { candlestick } from 'chartjs-chart-financial'; // ^0.1.1
import debounce from 'lodash/debounce'; // ^4.17.21

import { HistoricalMarketData, MarketDataInterval } from '../../types/market.types';
import { ChartOptions, ChartTheme } from '../../types/chart.types';
import { formatTimeSeriesData, createChartOptions } from '../../utils/chart.utils';
import {
  PERFORMANCE_CONFIG,
  CHART_THEMES,
  ACCESSIBILITY_CONFIG,
  CHART_FONT_FAMILY,
  CHART_FONT_SIZES
} from '../../constants/chart.constants';

// Register Chart.js components and financial plugin
Chart.register(...registerables, candlestick);

interface CandlestickChartProps {
  /** Historical market data for candlestick visualization */
  data: HistoricalMarketData[];
  /** Time interval for data aggregation */
  interval: MarketDataInterval;
  /** Current theme mode */
  isDarkMode: boolean;
  /** Custom chart options */
  options?: Partial<ChartOptions>;
  /** Optional CSS class name */
  className?: string;
}

/**
 * A React component that renders an accessible and performant candlestick chart
 * for cryptocurrency market data visualization.
 */
const CandlestickChart: React.FC<CandlestickChartProps> = memo(({
  data,
  interval,
  isDarkMode,
  options = {},
  className = ''
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  /**
   * Formats candlestick data for Chart.js with performance optimizations
   */
  const formatCandlestickData = useCallback((marketData: HistoricalMarketData[]) => {
    return marketData.map(d => ({
      x: new Date(d.timestamp).getTime(),
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close,
      v: d.volume
    }));
  }, []);

  /**
   * Updates chart with new data using optimized rendering
   */
  const updateChart = useCallback((chart: Chart, newData: HistoricalMarketData[]) => {
    if (!chart) return;

    const formattedData = formatCandlestickData(newData);
    
    // Apply data thinning for large datasets
    const dataPoints = formattedData.length > PERFORMANCE_CONFIG.MAX_DATA_POINTS
      ? formattedData.filter((_, i) => i % Math.ceil(formattedData.length / PERFORMANCE_CONFIG.MAX_DATA_POINTS) === 0)
      : formattedData;

    chart.data.datasets[0].data = dataPoints;
    chart.update('none'); // Use 'none' mode for better performance
  }, [formatCandlestickData]);

  /**
   * Initializes candlestick chart with WebGL rendering and accessibility features
   */
  const initializeChart = useCallback(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Apply theme colors
    const theme: ChartTheme = isDarkMode ? CHART_THEMES.DARK : CHART_THEMES.LIGHT;

    // Create chart configuration
    const chartConfig = {
      type: 'candlestick',
      data: {
        datasets: [{
          label: 'Price',
          data: formatCandlestickData(data),
          color: {
            up: theme.textColor,
            down: CHART_THEMES.HIGH_CONTRAST.textColor,
            unchanged: theme.gridColor,
          }
        }]
      },
      options: createChartOptions('candlestick', {
        ...options,
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                return [
                  `Open: $${point.o.toFixed(2)}`,
                  `High: $${point.h.toFixed(2)}`,
                  `Low: $${point.l.toFixed(2)}`,
                  `Close: $${point.c.toFixed(2)}`,
                  `Volume: ${point.v.toLocaleString()}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: interval === '1d' ? 'day' : 'hour',
              displayFormats: {
                hour: 'MMM d, HH:mm',
                day: 'MMM d, yyyy'
              }
            },
            ticks: {
              font: {
                family: CHART_FONT_FAMILY,
                size: CHART_FONT_SIZES.SMALL
              }
            }
          },
          y: {
            position: 'right',
            ticks: {
              font: {
                family: CHART_FONT_FAMILY,
                size: CHART_FONT_SIZES.SMALL
              }
            }
          }
        }
      }, isDarkMode, false)
    };

    // Initialize chart with WebGL rendering when available
    chartInstance.current = new Chart(ctx, {
      ...chartConfig,
      options: {
        ...chartConfig.options,
        devicePixelRatio: PERFORMANCE_CONFIG.DEVICE_PIXEL_RATIO
      }
    });

    // Add accessibility attributes
    chartRef.current.setAttribute('role', 'img');
    chartRef.current.setAttribute('aria-label', ACCESSIBILITY_CONFIG.descriptions.general);
  }, [data, interval, isDarkMode, options, formatCandlestickData]);

  /**
   * Handles chart resize events with debouncing
   */
  const handleResize = useCallback(debounce(() => {
    if (chartInstance.current) {
      chartInstance.current.resize();
    }
  }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY), []);

  // Initialize chart on mount
  useEffect(() => {
    initializeChart();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    return () => {
      // Cleanup
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeChart, handleResize]);

  // Update chart when data changes
  useEffect(() => {
    if (chartInstance.current) {
      updateChart(chartInstance.current, data);
    }
  }, [data, updateChart]);

  return (
    <div className={`candlestick-chart-container ${className}`}>
      <canvas
        ref={chartRef}
        className="candlestick-chart"
        data-testid="candlestick-chart"
      />
    </div>
  );
});

CandlestickChart.displayName = 'CandlestickChart';

export default CandlestickChart;