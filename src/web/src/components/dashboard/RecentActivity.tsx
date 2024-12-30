/**
 * @fileoverview A dashboard component that displays recent portfolio activities,
 * transactions, market events, and security alerts in a chronological list format.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react'; // ^18.2.0
import { useSelector } from 'react-redux'; // ^8.1.0
import { format } from 'date-fns'; // ^2.30.0
import useWebSocket from 'react-use-websocket'; // ^4.3.1
import Card from '../common/Card';
import Table from '../common/Table';
import { BaseComponentProps } from '../../types/common.types';

/**
 * Props interface for the RecentActivity component
 */
export interface RecentActivityProps extends BaseComponentProps {
  /** Maximum number of activities to display */
  limit?: number;
  /** Filter type for activities */
  filterType?: 'all' | 'transactions' | 'market' | 'security';
  /** Enable real-time updates */
  enableRealtime?: boolean;
  /** Error handler callback */
  onError?: (error: Error) => void;
}

/**
 * Interface for activity item data structure
 */
export interface ActivityItem {
  id: string;
  type: 'transaction' | 'market_alert' | 'security_alert';
  timestamp: Date;
  description: string;
  amount: number | null;
  asset: string | null;
  status: 'completed' | 'pending' | 'failed';
  severity: 'low' | 'medium' | 'high' | null;
  metadata: Record<string, unknown>;
}

/**
 * A dashboard component that displays recent activities with real-time updates
 */
const RecentActivity: React.FC<RecentActivityProps> = React.memo(({
  limit = 10,
  filterType = 'all',
  enableRealtime = true,
  onError,
  className,
  style,
  ariaLabel = 'Recent Activity List',
  id,
  dataTestId,
}) => {
  // WebSocket connection for real-time updates
  const { lastMessage, sendMessage } = useWebSocket(
    process.env.REACT_APP_WS_ENDPOINT || 'ws://localhost:8080/ws/activities',
    {
      onError: (error) => onError?.(error),
      shouldReconnect: () => true,
      reconnectInterval: 3000,
    }
  );

  // Select activities from Redux store
  const activities = useSelector((state: any) => state.portfolio.activities);

  // Memoized table columns configuration
  const columns = useMemo(() => [
    {
      id: 'timestamp',
      header: 'Time',
      accessor: (row: ActivityItem) => format(row.timestamp, 'HH:mm:ss'),
      width: { min: 100, max: 150, default: 120 },
      priority: 2,
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'type',
      cellRenderer: (value: ActivityItem['type']) => (
        <span className={`recent-activity__type recent-activity__type--${value}`}>
          {value.replace('_', ' ')}
        </span>
      ),
      width: { min: 120, max: 200, default: 150 },
      priority: 1,
    },
    {
      id: 'description',
      header: 'Description',
      accessor: 'description',
      width: { min: 200, max: 500, default: 300 },
      priority: 2,
    },
    {
      id: 'asset',
      header: 'Asset',
      accessor: 'asset',
      width: { min: 80, max: 150, default: 100 },
      priority: 0,
    },
    {
      id: 'amount',
      header: 'Amount',
      accessor: 'amount',
      cellRenderer: (value: number | null) => 
        value ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value) : '-',
      width: { min: 100, max: 200, default: 120 },
      priority: 1,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      cellRenderer: (value: ActivityItem['status']) => (
        <span className={`recent-activity__status recent-activity__status--${value}`}>
          {value}
        </span>
      ),
      width: { min: 100, max: 150, default: 120 },
      priority: 1,
    },
  ], []);

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let filtered = [...activities];
    
    if (filterType !== 'all') {
      filtered = filtered.filter(activity => 
        activity.type.startsWith(filterType));
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }, [activities, filterType, limit]);

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage && enableRealtime) {
      try {
        const newActivity = JSON.parse(lastMessage.data) as ActivityItem;
        // Dispatch action to update Redux store
        // This will be handled by the portfolio reducer
      } catch (error) {
        onError?.(new Error('Failed to parse WebSocket message'));
      }
    }
  }, [lastMessage, enableRealtime, onError]);

  // Subscribe to activity updates on mount
  useEffect(() => {
    if (enableRealtime) {
      sendMessage(JSON.stringify({ 
        action: 'subscribe', 
        channel: 'activities' 
      }));

      return () => {
        sendMessage(JSON.stringify({ 
          action: 'unsubscribe', 
          channel: 'activities' 
        }));
      };
    }
  }, [enableRealtime, sendMessage]);

  return (
    <Card
      id={id}
      className={`recent-activity ${className || ''}`}
      style={style}
      variant="default"
      padding="default"
      ariaLabel={ariaLabel}
      dataTestId={dataTestId}
    >
      <Table
        columns={columns}
        data={filteredActivities}
        virtualization={true}
        accessibility={{
          headerIdPrefix: 'activity-header',
          cellIdPrefix: 'activity-cell',
          announceChanges: true,
          enableKeyboardNavigation: true,
        }}
        responsive={{
          enabled: true,
          columnPriorities: {
            timestamp: 2,
            type: 1,
            description: 2,
            asset: 0,
            amount: 1,
            status: 1,
          },
        }}
        emptyStateComponent={
          <div className="recent-activity__empty">
            No recent activities to display
          </div>
        }
      />
    </Card>
  );
});

RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;