/**
 * AssetList Component
 * @version 1.0.0
 * @description A React component that displays a list of cryptocurrency assets in a portfolio
 * with real-time updates, responsive design, and accessibility support.
 */

import React, { useCallback, useMemo, memo } from 'react'; // ^18.2.0
import numeral from 'numeral'; // ^2.0.6

// Internal imports
import { Table } from '../common/Table';
import { Asset } from '../../types/portfolio.types';
import { usePortfolio } from '../../hooks/usePortfolio';

/**
 * Props interface for AssetList component
 */
interface AssetListProps {
  portfolioId: string;
  className?: string;
  virtualizeThreshold?: number;
  updateInterval?: number;
}

/**
 * Price change indicator type for styling
 */
type PriceChangeIndicator = 'positive' | 'negative' | 'neutral';

/**
 * Default values for component configuration
 */
const DEFAULT_VIRTUALIZE_THRESHOLD = 50;
const DEFAULT_UPDATE_INTERVAL = 30000; // 30 seconds

/**
 * Table column definitions with responsive priorities
 */
const COLUMNS = [
  {
    id: 'symbol',
    header: 'Asset',
    accessor: 'symbol',
    priority: 1,
    cellRenderer: (value: string) => (
      <div className="flex items-center">
        <img 
          src={`/assets/crypto-icons/${value.toLowerCase()}.svg`}
          alt={`${value} icon`}
          className="w-6 h-6 mr-2"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/crypto-icons/default.svg';
          }}
        />
        <span className="font-medium">{value}</span>
      </div>
    )
  },
  {
    id: 'quantity',
    header: 'Amount',
    accessor: 'quantity',
    priority: 2,
    cellRenderer: (value: number) => (
      <span className="font-mono">
        {numeral(value).format('0,0.00000000')}
      </span>
    )
  },
  {
    id: 'current_price',
    header: 'Price',
    accessor: 'current_price',
    priority: 3,
    cellRenderer: (value: number) => (
      <span className="font-mono">
        ${numeral(value).format('0,0.00')}
      </span>
    )
  },
  {
    id: 'total_value',
    header: 'Value',
    accessor: 'total_value',
    priority: 2,
    cellRenderer: (value: number) => (
      <span className="font-mono font-medium">
        ${numeral(value).format('0,0.00')}
      </span>
    )
  },
  {
    id: 'profit_loss',
    header: '24h Change',
    accessor: (row: Asset) => ({
      percentage: row.profit_loss_percentage,
      indicator: row.profit_loss_percentage > 0 ? 'positive' : 
                row.profit_loss_percentage < 0 ? 'negative' : 'neutral'
    }),
    priority: 3,
    cellRenderer: (value: { percentage: number; indicator: PriceChangeIndicator }) => (
      <RenderProfitLoss 
        percentage={value.percentage} 
        indicator={value.indicator} 
      />
    )
  },
  {
    id: 'actions',
    header: '',
    accessor: 'asset_id',
    priority: 1,
    cellRenderer: (value: string, row: Asset) => (
      <AssetActions assetId={value} symbol={row.symbol} />
    )
  }
];

/**
 * Memoized profit/loss display component
 */
const RenderProfitLoss = memo(({ 
  percentage, 
  indicator 
}: { 
  percentage: number; 
  indicator: PriceChangeIndicator;
}) => {
  const colorClass = {
    positive: 'text-green-500',
    negative: 'text-red-500',
    neutral: 'text-gray-500'
  }[indicator];

  const icon = {
    positive: '↑',
    negative: '↓',
    neutral: '→'
  }[indicator];

  return (
    <div 
      className={`flex items-center ${colorClass}`}
      role="status"
      aria-label={`Price change: ${percentage}%`}
    >
      <span className="mr-1">{icon}</span>
      <span className="font-mono">
        {numeral(Math.abs(percentage)).format('0,0.00')}%
      </span>
    </div>
  );
});

RenderProfitLoss.displayName = 'RenderProfitLoss';

/**
 * Memoized asset actions component
 */
const AssetActions = memo(({ 
  assetId, 
  symbol 
}: { 
  assetId: string; 
  symbol: string;
}) => {
  const { removeAsset } = usePortfolio(assetId);

  const handleRemove = useCallback(async () => {
    if (window.confirm(`Are you sure you want to remove ${symbol} from your portfolio?`)) {
      await removeAsset(assetId);
    }
  }, [assetId, symbol, removeAsset]);

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleRemove}
        className="text-red-500 hover:text-red-700 p-2 rounded"
        aria-label={`Remove ${symbol}`}
      >
        <span className="sr-only">Remove {symbol}</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
});

AssetActions.displayName = 'AssetActions';

/**
 * AssetList component implementation
 */
export const AssetList: React.FC<AssetListProps> = ({
  portfolioId,
  className,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD,
  updateInterval = DEFAULT_UPDATE_INTERVAL
}) => {
  const { 
    portfolio, 
    loading, 
    error, 
    refreshPrices 
  } = usePortfolio(portfolioId);

  // Memoize assets data for table
  const assets = useMemo(() => portfolio?.assets || [], [portfolio?.assets]);

  // Configure table settings
  const tableConfig = useMemo(() => ({
    virtualization: assets.length > virtualizeThreshold,
    sorting: {
      enabled: true,
      multiSort: false,
      defaultSort: [{ columnId: 'total_value', direction: 'desc' }]
    },
    responsive: {
      enabled: true,
      columnPriorities: COLUMNS.reduce((acc, col) => ({
        ...acc,
        [col.id]: col.priority
      }), {})
    },
    accessibility: {
      announceChanges: true,
      enableKeyboardNavigation: true
    }
  }), [assets.length, virtualizeThreshold]);

  // Set up auto-refresh interval
  React.useEffect(() => {
    const intervalId = setInterval(refreshPrices, updateInterval);
    return () => clearInterval(intervalId);
  }, [refreshPrices, updateInterval]);

  if (error) {
    return (
      <div className="text-red-500 p-4" role="alert">
        Error loading assets: {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <Table
        columns={COLUMNS}
        data={assets}
        {...tableConfig}
        isLoading={loading}
        emptyStateComponent={
          <div className="text-center py-8 text-gray-500">
            No assets in portfolio
          </div>
        }
        loadingComponent={
          <div className="text-center py-8 text-gray-500">
            Loading assets...
          </div>
        }
      />
    </div>
  );
};

export default memo(AssetList);