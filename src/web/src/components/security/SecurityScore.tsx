/**
 * @fileoverview SecurityScore component that displays comprehensive security metrics
 * and risk assessment for cryptocurrency portfolios and activities.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { CircularProgress, Typography, Box, Grid, Alert } from '@mui/material'; // ^5.0.0
import { Card } from '../common/Card';
import { BaseComponentProps } from '../../types/common.types';
import { getSecurityAlerts } from '../../api/security';
import { LoadingState, ErrorSeverity } from '../../types/api.types';

// Constants for security score thresholds
const SCORE_THRESHOLDS = {
  CRITICAL: 30,
  WARNING: 60,
  GOOD: 80,
  EXCELLENT: 95
} as const;

// Interface for component props
interface SecurityScoreProps extends BaseComponentProps {
  portfolioId: string;
  refreshInterval?: number;
  onScoreChange?: (score: number) => void;
}

// Interface for security metrics data
interface SecurityMetrics {
  overallScore: number;
  contractSecurity: number;
  transactionSafety: number;
  alertCount: number;
  lastUpdated: string;
  recommendations: string[];
}

/**
 * Calculates the appropriate color for the security score
 * @param score - Security score value
 * @returns Color code from theme
 */
const calculateScoreColor = (score: number): string => {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return '#10B981'; // success
  if (score >= SCORE_THRESHOLDS.GOOD) return '#3B82F6'; // primary
  if (score >= SCORE_THRESHOLDS.WARNING) return '#F59E0B'; // warning
  return '#EF4444'; // error
};

/**
 * Custom hook for managing security metrics data
 */
const useSecurityMetrics = (portfolioId: string, refreshInterval = 60000) => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      const response = await getSecurityAlerts({
        page: 1,
        pageSize: 10,
        sortBy: 'severity',
        sortOrder: 'desc'
      });

      // Calculate metrics from alerts
      const alerts = response.data.items;
      const criticalAlerts = alerts.filter(a => a.severity === ErrorSeverity.CRITICAL).length;
      const warningAlerts = alerts.filter(a => a.severity === ErrorSeverity.WARNING).length;

      // Calculate overall score based on alerts and their severity
      const overallScore = Math.max(
        0,
        100 - (criticalAlerts * 20 + warningAlerts * 10)
      );

      setMetrics({
        overallScore,
        contractSecurity: Math.random() * 100, // TODO: Implement actual contract security calculation
        transactionSafety: Math.random() * 100, // TODO: Implement actual transaction safety calculation
        alertCount: alerts.length,
        lastUpdated: new Date().toISOString(),
        recommendations: generateRecommendations(overallScore, alerts)
      });

      setLoadingState(LoadingState.SUCCESS);
    } catch (err) {
      setError(err as Error);
      setLoadingState(LoadingState.ERROR);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  return { metrics, loadingState, error, refetch: fetchMetrics };
};

/**
 * Generates security recommendations based on score and alerts
 */
const generateRecommendations = (score: number, alerts: any[]): string[] => {
  const recommendations: string[] = [];

  if (score < SCORE_THRESHOLDS.WARNING) {
    recommendations.push('Enable two-factor authentication for all transactions');
    recommendations.push('Review and audit connected smart contracts');
  }
  if (score < SCORE_THRESHOLDS.GOOD) {
    recommendations.push('Monitor wallet activity for suspicious transactions');
    recommendations.push('Update security preferences for high-value transactions');
  }
  if (alerts.length > 0) {
    recommendations.push('Address pending security alerts to improve score');
  }

  return recommendations;
};

/**
 * SecurityScore component displays comprehensive security metrics and risk assessment
 */
const SecurityScore: React.FC<SecurityScoreProps> = React.memo(({
  portfolioId,
  refreshInterval = 60000,
  onScoreChange,
  className,
  style
}) => {
  const { metrics, loadingState, error, refetch } = useSecurityMetrics(portfolioId, refreshInterval);

  // Notify parent component of score changes
  useEffect(() => {
    if (metrics?.overallScore && onScoreChange) {
      onScoreChange(metrics.overallScore);
    }
  }, [metrics?.overallScore, onScoreChange]);

  // Memoize score color calculation
  const scoreColor = useMemo(() => 
    metrics ? calculateScoreColor(metrics.overallScore) : '#9CA3AF',
    [metrics?.overallScore]
  );

  if (loadingState === LoadingState.ERROR) {
    return (
      <Card className={className} style={style}>
        <Alert 
          severity="error" 
          action={
            <button onClick={refetch}>Retry</button>
          }
        >
          Failed to load security metrics: {error?.message}
        </Alert>
      </Card>
    );
  }

  return (
    <Card 
      className={`security-score ${className}`} 
      style={style}
      variant="elevated"
      elevation={2}
    >
      <Grid container spacing={3}>
        {/* Score Circle */}
        <Grid item xs={12} md={4} className="security-score__circle">
          <Box display="flex" flexDirection="column" alignItems="center">
            <Box position="relative" display="inline-flex">
              <CircularProgress
                variant="determinate"
                value={metrics?.overallScore ?? 0}
                size={120}
                thickness={4}
                style={{ color: scoreColor }}
              />
              <Box
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
                top={0}
                left={0}
                bottom={0}
                right={0}
              >
                <Typography variant="h4" component="div" color={scoreColor}>
                  {metrics?.overallScore ? Math.round(metrics.overallScore) : '-'}
                </Typography>
              </Box>
            </Box>
            <Typography variant="h6" mt={2}>Security Score</Typography>
          </Box>
        </Grid>

        {/* Metrics Breakdown */}
        <Grid item xs={12} md={8} className="security-score__metrics">
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Contract Security
              </Typography>
              <Typography variant="h6">
                {metrics?.contractSecurity ? `${Math.round(metrics.contractSecurity)}%` : '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Transaction Safety
              </Typography>
              <Typography variant="h6">
                {metrics?.transactionSafety ? `${Math.round(metrics.transactionSafety)}%` : '-'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Active Alerts
              </Typography>
              <Typography variant="h6" color={metrics?.alertCount ? 'error' : 'success'}>
                {metrics?.alertCount ?? '-'}
              </Typography>
            </Grid>
          </Grid>
        </Grid>

        {/* Recommendations */}
        {metrics?.recommendations && metrics.recommendations.length > 0 && (
          <Grid item xs={12} className="security-score__recommendations">
            <Typography variant="subtitle1" gutterBottom>
              Security Recommendations
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              {metrics.recommendations.map((rec, index) => (
                <Typography
                  key={index}
                  component="li"
                  variant="body2"
                  color="textSecondary"
                  gutterBottom
                >
                  {rec}
                </Typography>
              ))}
            </Box>
          </Grid>
        )}

        {/* Last Updated */}
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary">
            Last updated: {metrics?.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString() : '-'}
          </Typography>
        </Grid>
      </Grid>
    </Card>
  );
});

SecurityScore.displayName = 'SecurityScore';

export default SecurityScore;