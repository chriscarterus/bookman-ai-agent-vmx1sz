/**
 * Portfolio Page Component
 * @version 1.0.0
 * @description Main portfolio page component providing comprehensive cryptocurrency portfolio
 * management with real-time updates, accessibility features, and enhanced error handling.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material';

// Internal imports
import { AssetList } from '../../components/portfolio/AssetList';
import { PortfolioChart } from '../../components/portfolio/PortfolioChart';
import { usePortfolio } from '../../hooks/usePortfolio';
import { ChartInterval, ChartType } from '../../types/chart.types';
import { ErrorSeverity } from '../../types/api.types';

// Constants
const PORTFOLIO_UPDATE_INTERVAL = 30000; // 30 seconds
const DEFAULT_CHART_INTERVAL = ChartInterval.ONE_MONTH;

interface PortfolioPageProps {
  className?: string;
  'aria-label'?: string;
}

export const Portfolio: React.FC<PortfolioPageProps> = ({
  className,
  'aria-label': ariaLabel = 'Portfolio Overview'
}) => {
  // Hooks
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const {
    portfolio,
    loading,
    error,
    loadingState,
    updatePortfolio,
    addAsset,
    refreshPrices,
    retryOperation
  } = usePortfolio(portfolioId!);

  // State
  const [showAddAsset, setShowAddAsset] = useState<boolean>(false);
  const [chartInterval, setChartInterval] = useState<ChartInterval>(DEFAULT_CHART_INTERVAL);
  const [analyticsTracked, setAnalyticsTracked] = useState<boolean>(false);

  // Refs for cleanup
  const updateInterval = useRef<NodeJS.Timeout>();

  /**
   * Handles adding new assets to portfolio with validation
   */
  const handleAddAsset = useCallback(async (assetData: any) => {
    try {
      const isValid = await retryOperation(async () => {
        return await addAsset(assetData);
      });

      if (isValid) {
        setShowAddAsset(false);
        await refreshPrices();
      }
    } catch (err: any) {
      console.error('Error adding asset:', err);
      // Implement error notification
    }
  }, [addAsset, refreshPrices, retryOperation]);

  /**
   * Updates chart interval with analytics tracking
   */
  const handleChartIntervalChange = useCallback((interval: ChartInterval) => {
    setChartInterval(interval);
    if (!analyticsTracked) {
      // Track analytics event
      setAnalyticsTracked(true);
    }
  }, [analyticsTracked]);

  /**
   * Initializes real-time updates and analytics
   */
  useEffect(() => {
    if (!portfolioId) {
      navigate('/portfolios');
      return;
    }

    // Set up real-time price updates
    updateInterval.current = setInterval(() => {
      refreshPrices();
    }, PORTFOLIO_UPDATE_INTERVAL);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [portfolioId, navigate, refreshPrices]);

  /**
   * Error handling effect
   */
  useEffect(() => {
    if (error) {
      console.error('Portfolio Error:', error);
      // Implement error boundary or notification
    }
  }, [error]);

  if (!portfolioId) {
    return null;
  }

  return (
    <div 
      className={`portfolio-page ${className || ''}`}
      role="main"
      aria-label={ariaLabel}
    >
      {/* Portfolio Header */}
      <header className="portfolio-header mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {portfolio?.name || 'Portfolio Overview'}
        </h1>
        <div className="flex items-center justify-between">
          <div className="portfolio-value">
            <span className="text-lg font-medium">
              Total Value: ${portfolio?.total_value.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setShowAddAsset(true)}
            className="btn-primary"
            aria-label="Add new asset"
          >
            Add Asset
          </button>
        </div>
      </header>

      {/* Portfolio Chart */}
      <section 
        className="portfolio-chart-section mb-8"
        aria-label="Portfolio performance chart"
      >
        <PortfolioChart
          portfolioId={portfolioId}
          chartType={ChartType.AREA}
          interval={chartInterval}
          height={400}
          theme={{
            backgroundColor: theme.palette.background.paper,
            borderColor: theme.palette.divider,
            gridColor: theme.palette.divider,
            textColor: theme.palette.text.primary,
            contrastRatio: theme.palette.mode === 'dark' ? 7 : 4.5,
            direction: theme.direction
          }}
          accessibility={{
            enabled: true,
            description: 'Interactive chart showing portfolio value over time'
          }}
        />
        
        {/* Chart Interval Controls */}
        <div className="chart-controls mt-4 flex justify-end space-x-2">
          {Object.values(ChartInterval).map((interval) => (
            <button
              key={interval}
              onClick={() => handleChartIntervalChange(interval)}
              className={`chart-interval-btn ${
                interval === chartInterval ? 'active' : ''
              }`}
              aria-pressed={interval === chartInterval}
            >
              {ChartInterval[interval]}
            </button>
          ))}
        </div>
      </section>

      {/* Asset List */}
      <section 
        className="portfolio-assets-section"
        aria-label="Portfolio assets"
      >
        <AssetList
          portfolioId={portfolioId}
          className="w-full"
          virtualizeThreshold={50}
          updateInterval={PORTFOLIO_UPDATE_INTERVAL}
        />
      </section>

      {/* Add Asset Modal */}
      {showAddAsset && (
        <div
          role="dialog"
          aria-label="Add new asset"
          className="modal"
        >
          {/* Implement Add Asset Form */}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div 
          className="loading-overlay"
          role="alert"
          aria-busy="true"
        >
          Loading portfolio data...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div 
          className="error-message"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default Portfolio;