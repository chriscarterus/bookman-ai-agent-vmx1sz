/**
 * MarketList Component
 * @version 1.0.0
 * @description A real-time cryptocurrency market data display component with
 * sorting, filtering, AI-powered predictions, and enhanced security features.
 */

import React, { 
  useState, 
  useEffect, 
  useMemo, 
  useCallback 
} from 'react';
import numeral from 'numeral'; // ^2.0.6
import { debounce } from 'lodash'; // ^4.17.21

// Internal imports
import { Table, TableColumn } from '../common/Table';
import { useMarketData } from '../../hooks/useMarketData';
import { Theme } from '../../types/common.types';
import { MarketData, PricePrediction } from '../../types/market.types';

// Types
export interface MarketListProps {
  symbols: string[];
  onRowClick?: (symbol: string) => void;
  showPredictions?: boolean;
  updateInterval?: number;
  theme?: Theme;
  accessibilityLevel?: 'A' | 'AA' | 'AAA';
  className?: string;
}

// Constants
const DEFAULT_UPDATE_INTERVAL = 5000;
const PRICE_CHANGE_THRESHOLD = {
  SIGNIFICANT: 5,
  MAJOR: 10
};

/**
 * Formats cryptocurrency price with intelligent decimal places
 * @param price - Numerical price value
 * @param currency - Currency symbol (default: USD)
 */
const formatPrice = (price: number, currency: string = 'USD'): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'N/A';
  }

  const format = price >= 1 ? '0,0.00' : '0,0.0000';
  return `${currency} ${numeral(price).format(format)}`;
};

/**
 * Formats percentage change with semantic color coding
 * @param percentage - Percentage value
 */
const formatPercentage = (percentage: number): JSX.Element => {
  if (typeof percentage !== 'number' || isNaN(percentage)) {
    return <span>N/A</span>;
  }

  const color = percentage > 0 ? 'text-success' : 
                percentage < 0 ? 'text-error' : 
                'text-neutral';
  
  const ariaLabel = `${Math.abs(percentage).toFixed(2)}% ${percentage >= 0 ? 'increase' : 'decrease'}`;

  return (
    <span 
      className={color}
      aria-label={ariaLabel}
      role="text"
    >
      {percentage > 0 ? '+' : ''}{percentage.toFixed(2)}%
    </span>
  );
};

export const MarketList: React.FC<MarketListProps> = ({
  symbols,
  onRowClick,
  showPredictions = true,
  updateInterval = DEFAULT_UPDATE_INTERVAL,
  theme = 'light',
  accessibilityLevel = 'AA',
  className
}) => {
  // State management
  const [sortColumn, setSortColumn] = useState<string>('market_cap');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filteredData, setFilteredData] = useState<MarketData[]>([]);

  // Custom hook for real-time market data
  const {
    marketData,
    predictions,
    predictionMetrics,
    loading,
    error,
    refresh,
    connectionState,
    lastUpdate
  } = useMarketData(symbols, '1m', {
    enablePredictions: showPredictions,
    updateInterval
  });

  // Memoized table columns configuration
  const columns = useMemo((): TableColumn[] => [
    {
      id: 'symbol',
      header: 'Symbol',
      accessor: 'symbol',
      width: { min: 80, max: 120, default: 100 },
      priority: 1,
      cellRenderer: (value: string) => (
        <span className="font-medium">{value.toUpperCase()}</span>
      )
    },
    {
      id: 'price',
      header: 'Price',
      accessor: 'price',
      width: { min: 100, max: 160, default: 130 },
      priority: 1,
      cellRenderer: (value: number) => formatPrice(value)
    },
    {
      id: 'change_24h',
      header: '24h Change',
      accessor: 'change_24h',
      width: { min: 100, max: 160, default: 130 },
      priority: 2,
      cellRenderer: (value: number) => formatPercentage(value)
    },
    {
      id: 'volume',
      header: '24h Volume',
      accessor: 'volume',
      width: { min: 120, max: 180, default: 150 },
      priority: 3,
      cellRenderer: (value: number) => formatPrice(value)
    },
    ...(showPredictions ? [{
      id: 'prediction',
      header: 'Predicted Price',
      accessor: (row: MarketData) => {
        const prediction = predictions.find(p => p.symbol === row.symbol);
        return prediction?.predicted_price;
      },
      width: { min: 120, max: 180, default: 150 },
      priority: 4,
      cellRenderer: (value: number) => formatPrice(value)
    }] : [])
  ], [predictions, showPredictions]);

  // Memoized sorting function
  const sortData = useCallback((data: MarketData[]) => {
    return [...data].sort((a, b) => {
      const aValue = sortColumn === 'prediction' ?
        predictions.find(p => p.symbol === a.symbol)?.predicted_price || 0 :
        a[sortColumn as keyof MarketData];
      const bValue = sortColumn === 'prediction' ?
        predictions.find(p => p.symbol === b.symbol)?.predicted_price || 0 :
        b[sortColumn as keyof MarketData];

      return sortDirection === 'asc' ? 
        (aValue > bValue ? 1 : -1) : 
        (aValue < bValue ? 1 : -1);
    });
  }, [sortColumn, sortDirection, predictions]);

  // Handle sort changes
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  // Debounced data update
  const updateFilteredData = useCallback(
    debounce((data: MarketData[]) => {
      const sorted = sortData(data);
      setFilteredData(sorted);
    }, 100),
    [sortData]
  );

  // Effect for updating filtered data
  useEffect(() => {
    updateFilteredData(marketData);
  }, [marketData, updateFilteredData]);

  // Handle errors
  if (error) {
    return (
      <div role="alert" className="market-list-error">
        <p>Error loading market data: {error.message}</p>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }

  return (
    <div 
      className={`market-list ${theme} ${className || ''}`}
      data-testid="market-list"
    >
      <Table
        columns={columns}
        data={filteredData}
        loading={loading}
        virtualization={true}
        sorting={{
          enabled: true,
          defaultSort: [{ columnId: sortColumn, direction: sortDirection }],
          onSort: ([{ columnId, direction }]) => handleSort(columnId, direction)
        }}
        responsive={{
          enabled: true,
          columnPriorities: columns.reduce((acc, col) => ({
            ...acc,
            [col.id]: col.priority
          }), {})
        }}
        accessibility={{
          announceChanges: true,
          enableKeyboardNavigation: true,
          headerIdPrefix: 'market-header',
          cellIdPrefix: 'market-cell'
        }}
        onRowClick={(row: MarketData) => onRowClick?.(row.symbol)}
        emptyStateComponent={
          <div className="empty-state">No market data available</div>
        }
        loadingComponent={
          <div className="loading-state">Loading market data...</div>
        }
      />
      {showPredictions && (
        <div className="prediction-metrics" aria-live="polite">
          <p>Last update: {new Date(lastUpdate).toLocaleTimeString()}</p>
          <p>Connection status: {connectionState}</p>
        </div>
      )}
    </div>
  );
};

export default MarketList;