/**
 * PerformanceMetrics Component
 * @description A React component that displays portfolio performance metrics and trends
 * using interactive charts and metrics cards. Includes real-time updates, accessibility
 * features, and responsive design.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Card, Grid, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21

// Internal imports
import LineChart from '../charts/LineChart';
import { usePortfolio } from '../../hooks/usePortfolio';
import { PortfolioPerformance } from '../../types/portfolio.types';

// Constants for performance metrics display
const UPDATE_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 250;

interface PerformanceMetricsProps {
  portfolioId: string;
  className?: string;
  timeRange?: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
}

/**
 * Formats currency values with locale support
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Formats percentage values with locale support
 */
const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  portfolioId,
  className = '',
  timeRange = '24h'
}) => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { portfolio, loading, error, loadingState } = usePortfolio(portfolioId);
  const [performanceData, setPerformanceData] = useState<PortfolioPerformance | null>(null);

  // Chart configuration
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          padding: 16
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: theme.palette.divider
        },
        ticks: {
          color: theme.palette.text.secondary
        }
      },
      y: {
        grid: {
          display: true,
          color: theme.palette.divider
        },
        ticks: {
          color: theme.palette.text.secondary,
          callback: (value: number) => formatCurrency(value)
        }
      }
    }
  }), [theme]);

  // Format chart data with accessibility considerations
  const formattedChartData = useMemo(() => {
    if (!performanceData?.performance_history) return [];
    
    return performanceData.performance_history.map(point => ({
      timestamp: new Date(point.timestamp).getTime(),
      value: point.value,
      label: `Portfolio value: ${formatCurrency(point.value)} at ${new Date(point.timestamp).toLocaleString()}`
    }));
  }, [performanceData]);

  // Handle real-time updates with debouncing
  const updatePerformanceData = useCallback(
    debounce((newData: PortfolioPerformance) => {
      setPerformanceData(newData);
    }, DEBOUNCE_DELAY),
    []
  );

  // Set up real-time updates
  useEffect(() => {
    if (!portfolio) return;

    const updateInterval = setInterval(() => {
      if (portfolio.performance_metrics) {
        updatePerformanceData(portfolio.performance_metrics);
      }
    }, UPDATE_INTERVAL);

    return () => clearInterval(updateInterval);
  }, [portfolio, updatePerformanceData]);

  // Error handling
  if (error) {
    return (
      <Card className={className} role="alert">
        <Typography color="error" variant="body1">
          Error loading performance metrics: {error}
        </Typography>
      </Card>
    );
  }

  return (
    <Card 
      className={className}
      aria-busy={loading}
      aria-live="polite"
    >
      <Grid container spacing={3} padding={3}>
        {/* Performance Summary */}
        <Grid item xs={12} md={4}>
          <Typography variant="h6" gutterBottom>
            Portfolio Performance
          </Typography>
          {loading ? (
            <Skeleton variant="rectangular" height={96} />
          ) : (
            <>
              <Typography variant="h4" component="p" gutterBottom>
                {formatCurrency(performanceData?.total_value || 0)}
              </Typography>
              <Typography
                variant="body1"
                color={performanceData?.profit_loss_percentage >= 0 ? 'success.main' : 'error.main'}
                aria-label={`Profit/Loss: ${formatPercentage(performanceData?.profit_loss_percentage || 0)}`}
              >
                {formatPercentage(performanceData?.profit_loss_percentage || 0)}
              </Typography>
            </>
          )}
        </Grid>

        {/* Performance Chart */}
        <Grid item xs={12} md={8}>
          <div style={{ height: isMobile ? 200 : 300 }}>
            {loading ? (
              <Skeleton variant="rectangular" height="100%" />
            ) : (
              <LineChart
                data={formattedChartData}
                options={chartOptions}
                a11yConfig={{
                  description: 'Portfolio value over time chart showing performance trends',
                  announceNewData: true
                }}
                localeConfig={{
                  locale: 'en-US',
                  numberFormat: {
                    style: 'currency',
                    currency: 'USD'
                  }
                }}
              />
            )}
          </div>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <Typography variant="subtitle2" padding={2}>
                  Total Profit/Loss
                </Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={48} />
                ) : (
                  <Typography variant="h6" padding={2}>
                    {formatCurrency(performanceData?.total_profit_loss || 0)}
                  </Typography>
                )}
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <Typography variant="subtitle2" padding={2}>
                  Best Performing Asset
                </Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={48} />
                ) : (
                  <Typography variant="h6" padding={2}>
                    {formatPercentage(performanceData?.best_performing_asset?.profit_percentage || 0)}
                  </Typography>
                )}
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Card>
  );
};

// Add display name for debugging
PerformanceMetrics.displayName = 'PerformanceMetrics';

export default React.memo(PerformanceMetrics);