/**
 * Dashboard Component
 * @description Main dashboard page component providing a comprehensive overview of cryptocurrency
 * portfolio, market data, learning progress, and security alerts with real-time updates.
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Grid,
  Container,
  Typography,
  Skeleton,
  Box,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material'; // ^5.0.0
import { useTranslation } from 'react-i18next'; // ^12.0.0

// Internal imports
import MarketOverview from '../../components/dashboard/MarketOverview';
import { useWebSocket } from '../../hooks/useWebSocket';
import { MarketData, PricePrediction } from '../../types/market.types';
import { LoadingState } from '../../types/api.types';

// Types
interface DashboardProps {
  refreshInterval?: number;
  initialData?: DashboardData;
}

interface DashboardData {
  marketData: MarketData[];
  portfolioMetrics: PortfolioMetrics;
  securityAlerts: SecurityAlert[];
}

interface PortfolioMetrics {
  totalValue: number;
  dailyChange: number;
  assets: number;
  performance: number;
}

interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
}

// Constants
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'DOT', 'ADA'];

/**
 * Dashboard component with real-time updates and responsive layout
 */
const Dashboard: React.FC<DashboardProps> = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  initialData
}) => {
  // Hooks
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.LOADING);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(initialData || null);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket connection for real-time updates
  const {
    isConnected,
    lastMessage,
    error: wsError,
    connectionState
  } = useWebSocket<MarketData>(
    DEFAULT_SYMBOLS.map(symbol => `market:${symbol}`),
    {
      autoReconnect: true,
      heartbeatEnabled: true,
      compression: true
    }
  );

  // Memoized grid spacing based on screen size
  const gridSpacing = useMemo(() => isMobile ? 2 : 3, [isMobile]);

  /**
   * Handles real-time market data updates
   */
  const handleMarketUpdate = useCallback((data: MarketData) => {
    setDashboardData(prev => {
      if (!prev) return null;
      const updatedMarketData = [...prev.marketData];
      const index = updatedMarketData.findIndex(item => item.symbol === data.symbol);
      
      if (index !== -1) {
        updatedMarketData[index] = data;
      } else {
        updatedMarketData.push(data);
      }

      return {
        ...prev,
        marketData: updatedMarketData
      };
    });
  }, []);

  /**
   * Refreshes dashboard data
   */
  const refreshDashboard = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      // Implement data refresh logic here
      setLoadingState(LoadingState.SUCCESS);
    } catch (err) {
      setError(err as Error);
      setLoadingState(LoadingState.ERROR);
    }
  }, []);

  // Initialize dashboard data
  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.data) {
      handleMarketUpdate(lastMessage.data);
    }
  }, [lastMessage, handleMarketUpdate]);

  // Set up refresh interval
  useEffect(() => {
    const intervalId = setInterval(refreshDashboard, refreshInterval);
    return () => clearInterval(intervalId);
  }, [refreshInterval, refreshDashboard]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      setError(new Error(`WebSocket error: ${wsError.message}`));
    }
  }, [wsError]);

  /**
   * Renders loading skeleton
   */
  if (loadingState === LoadingState.LOADING) {
    return (
      <Container maxWidth="xl">
        <Grid container spacing={gridSpacing}>
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  /**
   * Renders error state
   */
  if (loadingState === LoadingState.ERROR || error) {
    return (
      <Container maxWidth="xl">
        <Paper
          sx={{ p: 3, bgcolor: 'error.light', color: 'error.contrastText' }}
          role="alert"
        >
          <Typography variant="h6" gutterBottom>
            {t('dashboard.error.title')}
          </Typography>
          <Typography>
            {error?.message || t('dashboard.error.generic')}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Grid container spacing={gridSpacing}>
        {/* Market Overview Section */}
        <Grid item xs={12}>
          <MarketOverview
            symbols={DEFAULT_SYMBOLS}
            defaultInterval="1d"
            highContrastMode={theme.palette.mode === 'dark'}
            data-testid="market-overview"
          />
        </Grid>

        {/* Portfolio Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.portfolio.title')}
            </Typography>
            {dashboardData?.portfolioMetrics && (
              <Box>
                {/* Portfolio metrics implementation */}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Security Alerts Section */}
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ p: 3, height: '100%' }}
            role="region"
            aria-label={t('dashboard.security.title')}
          >
            <Typography variant="h6" gutterBottom>
              {t('dashboard.security.title')}
            </Typography>
            {dashboardData?.securityAlerts && (
              <Box>
                {/* Security alerts implementation */}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Connection Status */}
      {!isConnected && (
        <Box
          sx={{
            position: 'fixed',
            bottom: theme.spacing(2),
            right: theme.spacing(2),
            zIndex: theme.zIndex.snackbar
          }}
        >
          <Paper
            sx={{
              p: 2,
              bgcolor: 'warning.light',
              color: 'warning.contrastText'
            }}
            role="status"
          >
            <Typography variant="body2">
              {t('dashboard.connection.reconnecting')}
            </Typography>
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default Dashboard;