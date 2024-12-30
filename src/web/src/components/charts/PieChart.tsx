/**
 * @fileoverview A reusable pie chart component with enhanced accessibility,
 * internationalization support, and performance optimizations using Chart.js.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTranslation } from 'react-i18next';
import useChart from '../../hooks/useChart';
import { ChartType, ChartOptions, PieDataItem, BaseComponentProps } from '../../types/chart.types';
import { CHART_THEMES, CHART_COLORS, MINIMUM_CONTRAST_RATIO } from '../../constants/chart.constants';

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Interface for PieChart component props
 */
interface PieChartProps extends BaseComponentProps {
  data: PieDataItem[];
  options?: Partial<ChartOptions>;
  height?: number;
  width?: number;
  locale?: string;
  highContrast?: boolean;
  onSegmentClick?: (item: PieDataItem) => void;
}

/**
 * A reusable pie chart component for visualizing proportional data with
 * accessibility and internationalization support.
 */
const PieChart: React.FC<PieChartProps> = ({
  data,
  options,
  className = '',
  height = 300,
  width = 300,
  locale = 'en-US',
  highContrast = false,
  onSegmentClick,
  ariaLabel,
  ariaDescribedBy,
  dataTestId = 'pie-chart'
}) => {
  const { t } = useTranslation();
  
  // Initialize chart hook with accessibility configuration
  const {
    chartRef,
    updateData,
    isLoading,
    error
  } = useChart(
    ChartType.PIE,
    [],
    options,
    {
      enabled: true,
      description: ariaLabel || t('charts.pie.accessibility.description'),
      announceNewData: true,
      fallbackText: t('charts.pie.accessibility.fallback')
    }
  );

  /**
   * Format data for Chart.js with accessibility enhancements
   */
  const formattedData = useMemo(() => {
    if (!data?.length) return { labels: [], datasets: [] };

    const colors = highContrast
      ? CHART_THEMES.HIGH_CONTRAST
      : CHART_THEMES.LIGHT;

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return {
      labels: data.map(item => item.label),
      datasets: [{
        data: data.map(item => item.value),
        backgroundColor: data.map((item, index) => 
          item.color || CHART_COLORS.PRIMARY[index % CHART_COLORS.PRIMARY.length]
        ),
        borderColor: colors.borderColor,
        borderWidth: 1,
        hoverOffset: 4
      }],
      // Add ARIA labels for screen readers
      ariaLabels: data.map(item => ({
        label: item.label,
        percentage: `${((item.value / total) * 100).toFixed(1)}%`
      }))
    };
  }, [data, highContrast]);

  /**
   * Configure chart options with accessibility and theme support
   */
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          generateLabels: (chart: ChartJS) => {
            const data = chart.data.datasets[0].data;
            const total = data.reduce((sum: number, value: number) => sum + value, 0);
            
            return chart.data.labels?.map((label, index) => ({
              text: `${label} (${((data[index] / total) * 100).toFixed(1)}%)`,
              fillStyle: chart.data.datasets[0].backgroundColor?.[index],
              hidden: false,
              index
            })) || [];
          },
          font: {
            size: 12
          },
          padding: 16,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${new Intl.NumberFormat(locale).format(value)} (${percentage}%)`;
          }
        }
      }
    },
    ...options
  }), [options, locale]);

  /**
   * Handle segment click events
   */
  const handleClick = useCallback((event: any, elements: any[]) => {
    if (elements.length > 0 && onSegmentClick) {
      const index = elements[0].index;
      onSegmentClick(data[index]);
    }
  }, [data, onSegmentClick]);

  // Update chart data when props change
  useEffect(() => {
    updateData(formattedData);
  }, [formattedData, updateData]);

  // Add click event listener
  useEffect(() => {
    const chart = chartRef.current;
    if (chart && onSegmentClick) {
      chart.onclick = handleClick;
    }
    return () => {
      if (chart) {
        chart.onclick = null;
      }
    };
  }, [handleClick, chartRef]);

  if (error) {
    return (
      <div 
        className="pie-chart-error" 
        role="alert" 
        aria-live="polite"
      >
        {t('charts.pie.error')}
      </div>
    );
  }

  return (
    <div 
      className={`pie-chart-container ${className}`}
      style={{ height, width }}
      data-testid={dataTestId}
    >
      {isLoading ? (
        <div 
          className="pie-chart-loading" 
          role="status"
          aria-live="polite"
        >
          {t('charts.pie.loading')}
        </div>
      ) : (
        <canvas
          ref={chartRef}
          role="img"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          height={height}
          width={width}
        />
      )}
    </div>
  );
};

export default PieChart;