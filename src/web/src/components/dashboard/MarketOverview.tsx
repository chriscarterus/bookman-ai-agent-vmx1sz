/**
 * Market Overview Component
 * @description A React component that displays real-time cryptocurrency market data overview
 * with price charts, trends, and AI-powered predictions on the dashboard.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Card, Typography, Skeleton, useTheme, Box, IconButton } from '@mui/material'; // ^5.0.0
import { useIntl, FormattedMessage } from 'react-intl'; // ^6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import { MarketData, PricePrediction, TimeSeriesDataPoint } from '../../types/market.types';
import { useMarketData } from '../../hooks/useMarketData';
import LineChart from '../charts/LineChart';

// Constants
const UPDATE_INTERVAL = 5000; // 5 seconds
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'DOT', 'ADA'];
const CHART_HEIGHT = 300;

interface MarketOverviewProps {
  symbols?: string[];
  defaultInterval?: string;
  highContrastMode?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * Formats price change with accessibility considerations
 */
const formatPriceChange = (change: number) => {
  const formattedValue = change.toFixed(2);
  const isPositive = change > 0;
  const color = isPositive ? 'success.main' : 'error.main';
  const sign = isPositive ? '+' : '';
  const ariaLabel = `${isPositive ? 'Increased' : 'Decreased'} by ${Math.abs(change)}%`;

  return {
    color,
    value: `${sign}${formattedValue}%`,
    ariaLabel
  };
};

/**
 * Market Overview Component
 */
const MarketOverview: React.FC<MarketOverviewProps> = memo(({
  symbols = DEFAULT_SYMBOLS,
  defaultInterval = '1d',
  highContrastMode = false,
  className = '',
  'data-testid': dataTestId = 'market-overview'
}) => {
  const theme = useTheme();
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);

  // State management
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbols[0]);
  const [chartData, setChartData] = useState<TimeSeriesDataPoint[]>([]);

  // Fetch market data using custom hook
  const {
    marketData,
    predictions,
    loading,
    error,
    refresh,
    lastUpdate
  } = useMarketData(symbols, defaultInterval);

  /**
   * Transforms market data into chart-compatible format
   */
  const transformChartData = useCallback((data: MarketData[]) => {
    return data.map(item => ({
      timestamp: new Date(item.timestamp).getTime(),
      value: item.price,
      label: item.symbol
    }));
  }, []);

  /**
   * Updates chart data when market data changes
   */
  useEffect(() => {
    if (marketData?.length) {
      setChartData(transformChartData(marketData));
    }
  }, [marketData, transformChartData]);

  /**
   * Sets up auto-refresh interval
   */
  useEffect(() => {
    const intervalId = setInterval(refresh, UPDATE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [refresh]);

  /**
   * Handles error fallback UI
   */
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Box
      role="alert"
      p={2}
      bgcolor="error.light"
      color="error.contrastText"
      borderRadius={1}
    >
      <Typography variant="h6" component="h3">
        <FormattedMessage id="marketOverview.error.title" defaultMessage="Error Loading Market Data" />
      </Typography>
      <Typography variant="body2">
        {error.message}
      </Typography>
    </Box>
  );

  /**
   * Renders loading skeleton
   */
  if (loading) {
    return (
      <Card className={className} data-testid={`${dataTestId}-loading`}>
        <Box p={2}>
          <Skeleton variant="rectangular" height={50} />
          <Box mt={2}>
            <Skeleton variant="rectangular" height={CHART_HEIGHT} />
          </Box>
          <Box mt={2}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Card 
        className={className}
        data-testid={dataTestId}
        ref={containerRef}
        sx={{
          height: '100%',
          '& .MuiCardContent-root': {
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <Box p={2}>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ mb: 2 }}
            aria-live="polite"
          >
            <FormattedMessage id="marketOverview.title" defaultMessage="Market Overview" />
          </Typography>

          {/* Market Data Grid */}
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
            gap={2}
            mb={3}
          >
            {marketData.map((item) => {
              const priceChange = formatPriceChange(item.change_24h);
              const prediction = predictions.find(p => p.symbol === item.symbol);

              return (
                <Box
                  key={item.symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  onKeyPress={(e) => e.key === 'Enter' && setSelectedSymbol(item.symbol)}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: '2px'
                    }
                  }}
                  aria-selected={selectedSymbol === item.symbol}
                >
                  <Typography variant="h6" component="span">
                    {item.symbol}
                  </Typography>
                  <Typography
                    variant="h5"
                    component="div"
                    aria-label={intl.formatMessage(
                      { id: 'marketOverview.price' },
                      { symbol: item.symbol, price: item.price }
                    )}
                  >
                    ${item.price.toLocaleString()}
                  </Typography>
                  <Typography
                    color={priceChange.color}
                    aria-label={priceChange.ariaLabel}
                  >
                    {priceChange.value}
                  </Typography>
                  {prediction && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      aria-label={intl.formatMessage(
                        { id: 'marketOverview.prediction' },
                        { symbol: item.symbol, price: prediction.predicted_price }
                      )}
                    >
                      <FormattedMessage
                        id="marketOverview.prediction.label"
                        defaultMessage="Predicted: ${price}"
                        values={{ price: prediction.predicted_price.toLocaleString() }}
                      />
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Price Chart */}
          <Box height={CHART_HEIGHT}>
            <LineChart
              data={chartData.filter(data => data.label === selectedSymbol)}
              options={{
                maintainAspectRatio: false,
                interaction: {
                  intersect: false,
                  mode: 'index'
                }
              }}
              theme={{
                contrastRatio: highContrastMode ? 7 : 4.5,
                direction: theme.direction
              }}
              a11yConfig={{
                announceNewData: true,
                description: intl.formatMessage(
                  { id: 'marketOverview.chart.description' },
                  { symbol: selectedSymbol }
                )
              }}
            />
          </Box>

          {/* Last Update Timestamp */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2 }}
            aria-live="polite"
          >
            <FormattedMessage
              id="marketOverview.lastUpdate"
              defaultMessage="Last updated: {time}"
              values={{
                time: new Date(lastUpdate).toLocaleTimeString()
              }}
            />
          </Typography>
        </Box>
      </Card>
    </ErrorBoundary>
  );
});

MarketOverview.displayName = 'MarketOverview';

export default MarketOverview;