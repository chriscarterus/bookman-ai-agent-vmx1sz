/**
 * @fileoverview Enhanced transaction history component with virtualization and accessibility
 * @version 1.0.0
 * @license MIT
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // v2.3.2
import { Transaction } from '../../types/portfolio.types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format.utils';

/**
 * Props interface for the TransactionHistory component
 */
interface TransactionHistoryProps {
  transactions: Transaction[];
  loading: boolean;
  onSort: (column: string, direction: 'asc' | 'desc') => void;
  className?: string;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  enableVirtualization?: boolean;
  refreshInterval?: number;
  locale?: string;
  timeZone?: string;
  highContrastMode?: boolean;
  ariaLabel?: string;
}

/**
 * Column configuration for the transaction table
 */
const TRANSACTION_COLUMNS = [
  {
    id: 'timestamp',
    header: 'Date',
    accessor: 'timestamp',
    sortable: true,
    ariaLabel: 'Sort by date'
  },
  {
    id: 'type',
    header: 'Type',
    accessor: 'type',
    sortable: true,
    ariaLabel: 'Sort by transaction type'
  },
  {
    id: 'quantity',
    header: 'Amount',
    accessor: 'quantity',
    sortable: true,
    ariaLabel: 'Sort by amount'
  },
  {
    id: 'price',
    header: 'Price',
    accessor: 'price',
    sortable: true,
    ariaLabel: 'Sort by price'
  },
  {
    id: 'total_amount',
    header: 'Total',
    accessor: 'total_amount',
    sortable: true,
    ariaLabel: 'Sort by total amount'
  }
] as const;

/**
 * Transaction type color mapping with high contrast support
 */
const TRANSACTION_TYPE_COLORS = {
  buy: {
    default: 'bg-green-100 text-green-800',
    highContrast: 'bg-green-200 text-green-900'
  },
  sell: {
    default: 'bg-red-100 text-red-800',
    highContrast: 'bg-red-200 text-red-900'
  },
  transfer: {
    default: 'bg-blue-100 text-blue-800',
    highContrast: 'bg-blue-200 text-blue-900'
  },
  stake: {
    default: 'bg-yellow-100 text-yellow-800',
    highContrast: 'bg-yellow-200 text-yellow-900'
  },
  unstake: {
    default: 'bg-yellow-100 text-yellow-800',
    highContrast: 'bg-yellow-200 text-yellow-900'
  }
} as const;

/**
 * Returns appropriate color class for transaction type with contrast support
 */
const getTransactionTypeColor = (type: Transaction['type'], highContrast: boolean): string => {
  const colors = TRANSACTION_TYPE_COLORS[type];
  return colors ? (highContrast ? colors.highContrast : colors.default) : '';
};

/**
 * Renders transaction type badge with appropriate styling and accessibility
 */
const renderTransactionType = (type: Transaction['type'], highContrast: boolean): JSX.Element => {
  const colorClass = getTransactionTypeColor(type, highContrast);
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  
  return (
    <span
      className={classNames(
        'px-2 py-1 rounded-full text-sm font-medium inline-flex items-center',
        colorClass
      )}
      role="status"
      aria-label={`Transaction type: ${formattedType}`}
    >
      {formattedType}
    </span>
  );
};

/**
 * TransactionHistory component with enhanced features and accessibility
 */
const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  loading,
  onSort,
  className,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  enableVirtualization = true,
  refreshInterval = 30000,
  locale = 'en-US',
  timeZone = 'UTC',
  highContrastMode = false,
  ariaLabel = 'Transaction History Table'
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [sortColumn, setSortColumn] = React.useState('timestamp');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Memoized sorted and paginated transactions
  const displayedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return transactions.slice(startIndex, endIndex);
  }, [transactions, currentPage, pageSize]);

  // Handle column sort
  const handleSort = useCallback((columnId: string) => {
    const newDirection = columnId === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnId);
    setSortDirection(newDirection);
    onSort(columnId, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  // Auto-refresh effect
  useEffect(() => {
    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        // Trigger refresh only if table is in viewport
        if (tableRef.current?.getBoundingClientRect().top < window.innerHeight) {
          onSort(sortColumn, sortDirection);
        }
      }, refreshInterval);

      return () => clearInterval(timer);
    }
  }, [refreshInterval, sortColumn, sortDirection, onSort]);

  // Render loading state
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-full mb-4" />
        {Array.from({ length: pageSize }).map((_, index) => (
          <div key={index} className="h-16 bg-gray-100 rounded w-full mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={tableRef}
      className={classNames('overflow-hidden rounded-lg shadow', className)}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {TRANSACTION_COLUMNS.map(column => (
                <th
                  key={column.id}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.sortable ? (
                    <button
                      className="group inline-flex items-center space-x-1"
                      onClick={() => handleSort(column.id)}
                      aria-label={column.ariaLabel}
                    >
                      <span>{column.header}</span>
                      <span className={classNames(
                        'transition-colors',
                        sortColumn === column.id ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'
                      )}>
                        {sortColumn === column.id && sortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedTransactions.map(transaction => (
              <tr
                key={transaction.transaction_id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(transaction.timestamp, 'PPp', { locale, timeZone })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {renderTransactionType(transaction.type, highContrastMode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatNumber(transaction.quantity, locale, { maximumFractionDigits: 8 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(transaction.price, 'USD', locale)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(transaction.total_amount, 'USD', locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={classNames(
              'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
              currentPage === 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={displayedTransactions.length < pageSize}
            className={classNames(
              'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
              displayedTransactions.length < pageSize
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;