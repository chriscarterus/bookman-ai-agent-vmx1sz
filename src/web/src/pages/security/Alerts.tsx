/**
 * Security Alerts Dashboard Page Component
 * @version 1.0.0
 * @description Displays comprehensive security alerts with enhanced filtering, sorting, and responsive design
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CircularProgress, Alert, Chip, IconButton } from '@mui/material'; // ^5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0

// Internal imports
import FraudAlert from '../../components/security/FraudAlert';
import SecurityScore from '../../components/security/SecurityScore';
import { getSecurityAlerts, updateAlertStatus } from '../../api/security';
import { Card } from '../../components/common/Card';
import { ErrorSeverity, LoadingState } from '../../types/api.types';

// Alert severity options
const SEVERITY_OPTIONS = [
  { label: 'Critical', value: ErrorSeverity.CRITICAL },
  { label: 'Error', value: ErrorSeverity.ERROR },
  { label: 'Warning', value: ErrorSeverity.WARNING },
  { label: 'Info', value: ErrorSeverity.INFO }
];

// Sort options
const SORT_OPTIONS = [
  { label: 'Newest First', value: 'timestamp_desc' },
  { label: 'Oldest First', value: 'timestamp_asc' },
  { label: 'Highest Risk', value: 'risk_desc' },
  { label: 'Lowest Risk', value: 'risk_asc' }
];

// Interface for component props
interface AlertsPageProps {
  userId: string;
  portfolioId: string;
  defaultSeverityFilter?: string[];
  defaultSort?: string;
}

// Interface for alerts state
interface AlertsState {
  alerts: any[];
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  severityFilters: string[];
  sortOrder: string;
  lastRefresh: Date;
  retryCount: number;
}

/**
 * Security Alerts Dashboard Page Component
 */
const AlertsPage: React.FC<AlertsPageProps> = ({
  userId,
  portfolioId,
  defaultSeverityFilter = [],
  defaultSort = 'timestamp_desc'
}) => {
  // State management
  const [state, setState] = useState<AlertsState>({
    alerts: [],
    loading: true,
    error: null,
    page: 1,
    hasMore: true,
    severityFilters: defaultSeverityFilter,
    sortOrder: defaultSort,
    lastRefresh: new Date(),
    retryCount: 0
  });

  // Virtual scroll container ref
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Virtual scroll configuration
  const rowVirtualizer = useVirtualizer({
    count: state.alerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  // Fetch alerts with debouncing and retry logic
  const fetchAlerts = useCallback(async (reset = false) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await getSecurityAlerts({
        page: reset ? 1 : state.page,
        pageSize: 20,
        severity: state.severityFilters,
        sortBy: state.sortOrder.split('_')[0],
        sortOrder: state.sortOrder.split('_')[1]
      });

      setState(prev => ({
        ...prev,
        alerts: reset ? response.data.items : [...prev.alerts, ...response.data.items],
        loading: false,
        page: reset ? 2 : prev.page + 1,
        hasMore: response.data.hasNext,
        lastRefresh: new Date(),
        retryCount: 0
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch security alerts',
        retryCount: prev.retryCount + 1
      }));
    }
  }, [state.page, state.severityFilters, state.sortOrder]);

  // Initial load and refresh interval
  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(true), 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Handle filter changes
  const handleFilterChange = useCallback((severity: string) => {
    setState(prev => ({
      ...prev,
      severityFilters: prev.severityFilters.includes(severity)
        ? prev.severityFilters.filter(s => s !== severity)
        : [...prev.severityFilters, severity],
      page: 1
    }));
  }, []);

  // Handle sort changes
  const handleSortChange = useCallback((sort: string) => {
    setState(prev => ({
      ...prev,
      sortOrder: sort,
      page: 1
    }));
  }, []);

  // Handle alert status updates
  const handleAlertUpdate = useCallback(async (alertId: string, status: string) => {
    try {
      await updateAlertStatus(alertId, { status });
      setState(prev => ({
        ...prev,
        alerts: prev.alerts.map(alert =>
          alert.id === alertId ? { ...alert, status } : alert
        )
      }));
    } catch (error) {
      console.error('Failed to update alert status:', error);
    }
  }, []);

  // Memoized filtered and sorted alerts
  const processedAlerts = useMemo(() => {
    return state.alerts.filter(alert =>
      state.severityFilters.length === 0 || state.severityFilters.includes(alert.severity)
    );
  }, [state.alerts, state.severityFilters]);

  return (
    <div className="alerts-page">
      <div className="alerts-page__header">
        <SecurityScore
          portfolioId={portfolioId}
          refreshInterval={60000}
          className="alerts-page__security-score"
        />
      </div>

      <Card className="alerts-page__filters">
        <div className="alerts-page__filter-group">
          {SEVERITY_OPTIONS.map(({ label, value }) => (
            <Chip
              key={value}
              label={label}
              color={state.severityFilters.includes(value) ? 'primary' : 'default'}
              onClick={() => handleFilterChange(value)}
              className="alerts-page__filter-chip"
            />
          ))}
        </div>

        <div className="alerts-page__sort-group">
          {SORT_OPTIONS.map(({ label, value }) => (
            <Chip
              key={value}
              label={label}
              color={state.sortOrder === value ? 'primary' : 'default'}
              onClick={() => handleSortChange(value)}
              className="alerts-page__sort-chip"
            />
          ))}
        </div>
      </Card>

      {state.error && (
        <Alert 
          severity="error" 
          className="alerts-page__error"
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={() => fetchAlerts(true)}
            >
              Retry
            </IconButton>
          }
        >
          {state.error}
        </Alert>
      )}

      <div 
        ref={parentRef}
        className="alerts-page__content"
        style={{ height: '600px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const alert = processedAlerts[virtualRow.index];
            return (
              <div
                key={alert.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <FraudAlert
                  alertId={alert.id}
                  severity={alert.severity}
                  details={alert.details}
                  onDismiss={(id) => handleAlertUpdate(id, 'DISMISSED')}
                  onInvestigate={(id) => handleAlertUpdate(id, 'IN_PROGRESS')}
                />
              </div>
            );
          })}
        </div>
      </div>

      {state.loading && (
        <div className="alerts-page__loading">
          <CircularProgress />
        </div>
      )}

      <style jsx>{`
        .alerts-page {
          padding: var(--spacing-4);
          max-width: 1440px;
          margin: 0 auto;
        }

        .alerts-page__header {
          margin-bottom: var(--spacing-4);
        }

        .alerts-page__filters {
          margin-bottom: var(--spacing-4);
          padding: var(--spacing-4);
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-2);
        }

        .alerts-page__filter-group,
        .alerts-page__sort-group {
          display: flex;
          gap: var(--spacing-2);
          flex-wrap: wrap;
        }

        .alerts-page__content {
          background: var(--color-background-paper);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .alerts-page__loading {
          display: flex;
          justify-content: center;
          padding: var(--spacing-4);
        }

        .alerts-page__error {
          margin-bottom: var(--spacing-4);
        }

        @media (max-width: 768px) {
          .alerts-page {
            padding: var(--spacing-2);
          }

          .alerts-page__filters {
            flex-direction: column;
          }
        }

        @media (min-width: 1024px) {
          .alerts-page__content {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: var(--spacing-4);
          }
        }
      `}</style>
    </div>
  );
};

export default React.memo(AlertsPage);