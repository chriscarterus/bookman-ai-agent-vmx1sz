/**
 * @fileoverview Asset Distribution Component for Portfolio Dashboard
 * @version 1.0.0
 * @description A React component that visualizes portfolio asset distribution using
 * an accessible pie chart with real-time updates and WCAG 2.1 AA compliance.
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material'; // ^5.0.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import PieChart from '../charts/PieChart';
import { Asset } from '../../types/portfolio.types';
import usePortfolio from '../../hooks/usePortfolio';

// Constants for accessibility and performance
const DEFAULT_REFRESH_INTERVAL = 60000; // 1 minute
const DEFAULT_MAX_VISIBLE_ASSETS = 5;
const MINIMUM_PERCENTAGE_THRESHOLD = 1;
const HIGH_CONTRAST_RATIO = 7;

/**
 * Props interface for AssetDistribution component
 */
interface AssetDistributionProps {
  portfolioId: string;
  className?: string;
  refreshInterval?: number;
  onError?: (error: Error) => void;
  showLegend?: boolean;
  maxVisibleAssets?: number;
}

/**
 * Interface for formatted asset data with accessibility metadata
 */
interface FormattedAssetData {
  id: string;
  value: number;
  percentage: number;
  color: string;
  label: string;
  description: string;
}

/**
 * Formats portfolio assets data into accessible pie chart format
 */
const formatAssetData = (
  assets: Asset[],
  theme: any,
  highContrast: boolean
): FormattedAssetData[] => {
  if (!assets?.length) return [];

  // Calculate total portfolio value
  const totalValue = assets.reduce((sum, asset) => sum + asset.total_value, 0);

  // Sort assets by value in descending order
  const sortedAssets = [...assets].sort((a, b) => b.total_value - a.total_value);

  // Generate color palette with appropriate contrast
  const colors = highContrast
    ? theme.palette.highContrast
    : theme.palette.chart;

  // Format and group assets
  let formattedAssets = sortedAssets.map((asset, index) => {
    const percentage = (asset.total_value / totalValue) * 100;
    return {
      id: asset.asset_id,
      value: asset.total_value,
      percentage,
      color: colors[index % colors.length],
      label: asset.symbol,
      description: `${asset.symbol}: ${percentage.toFixed(1)}% of portfolio`
    };
  });

  // Group small holdings into "Others" category if needed
  if (formattedAssets.length > DEFAULT_MAX_VISIBLE_ASSETS) {
    const visibleAssets = formattedAssets.slice(0, DEFAULT_MAX_VISIBLE_ASSETS - 1);
    const otherAssets = formattedAssets.slice(DEFAULT_MAX_VISIBLE_ASSETS - 1);
    
    const othersValue = otherAssets.reduce((sum, asset) => sum + asset.value, 0);
    const othersPercentage = (othersValue / totalValue) * 100;

    visibleAssets.push({
      id: 'others',
      value: othersValue,
      percentage: othersPercentage,
      color: colors[DEFAULT_MAX_VISIBLE_ASSETS - 1],
      label: 'Others',
      description: `Other assets: ${othersPercentage.toFixed(1)}% of portfolio`
    });

    formattedAssets = visibleAssets;
  }

  return formattedAssets;
};

/**
 * AssetDistribution component for visualizing portfolio asset distribution
 */
const AssetDistribution: React.FC<AssetDistributionProps> = ({
  portfolioId,
  className = '',
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  onError,
  showLegend = true,
  maxVisibleAssets = DEFAULT_MAX_VISIBLE_ASSETS
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { portfolio, loading, error, refreshPrices } = usePortfolio(portfolioId);

  // Format asset data with accessibility considerations
  const chartData = useMemo(() => {
    if (!portfolio?.assets) return [];
    return formatAssetData(
      portfolio.assets,
      theme,
      theme.palette.mode === 'highContrast'
    );
  }, [portfolio?.assets, theme]);

  // Handle chart segment click
  const handleSegmentClick = useCallback((segment: FormattedAssetData) => {
    console.debug('Chart segment clicked:', segment);
  }, []);

  // Set up automatic refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      refreshPrices().catch((err) => {
        console.error('Failed to refresh prices:', err);
        onError?.(err);
      });
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, refreshPrices, onError]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div
      role="alert"
      className="asset-distribution-error"
      aria-live="polite"
    >
      <h3>{t('errors.chartLoadFailed')}</h3>
      <p>{error.message}</p>
    </div>
  );

  // Handle loading state
  if (loading) {
    return (
      <div
        role="status"
        className={`asset-distribution-loading ${className}`}
        aria-live="polite"
      >
        {t('common.loading')}
      </div>
    );
  }

  // Handle error state
  if (error) {
    return <ErrorFallback error={error} />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={onError}
    >
      <div 
        className={`asset-distribution ${className}`}
        aria-label={t('portfolio.assetDistribution.title')}
      >
        <PieChart
          data={chartData}
          options={{
            plugins: {
              legend: {
                display: showLegend,
                position: 'bottom',
                labels: {
                  generateLabels: (chart) => {
                    const data = chart.data.datasets[0].data;
                    const total = data.reduce((sum: number, value: number) => sum + value, 0);
                    
                    return chartData.map((item, index) => ({
                      text: `${item.label} (${(item.percentage).toFixed(1)}%)`,
                      fillStyle: item.color,
                      hidden: false,
                      index
                    }));
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.raw;
                    const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                  }
                }
              }
            }
          }}
          height={300}
          width={300}
          onSegmentClick={handleSegmentClick}
          ariaLabel={t('portfolio.assetDistribution.chartDescription')}
          ariaDescribedBy="asset-distribution-description"
          dataTestId="asset-distribution-chart"
        />
        <div id="asset-distribution-description" className="sr-only">
          {t('portfolio.assetDistribution.accessibleDescription')}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AssetDistribution;