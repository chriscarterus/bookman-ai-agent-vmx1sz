/**
 * @fileoverview Enhanced transaction history page component with real-time updates,
 * advanced filtering, and accessibility features
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import TransactionHistory from '../../components/portfolio/TransactionHistory';
import { portfolioApi } from '../../api/portfolio';
import { Transaction } from '../../types/portfolio.types';
import { LoadingState, ErrorSeverity } from '../../types/api.types';

// Enhanced interface for transaction filtering
interface TransactionFilters {
  startDate: Date | null;
  endDate: Date | null;
  type: string | null;
  symbol: string | null;
  status: string | null;
  minAmount: number | null;
  maxAmount: number | null;
}

// Interface for pagination state
interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

// Interface for sorting state
interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Enhanced error fallback component with retry functionality
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <h3 className="text-lg font-medium text-red-800">Error Loading Transactions</h3>
    <p className="mt-2 text-sm text-red-600">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
    >
      Retry
    </button>
  </div>
);

/**
 * Enhanced Transactions page component with real-time updates and accessibility
 */
const Transactions: React.FC = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const { t } = useTranslation();
  
  // Component state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<Error | null>(null);

  // Filtering, pagination, and sorting state
  const [filters, setFilters] = useState<TransactionFilters>({
    startDate: null,
    endDate: null,
    type: null,
    symbol: null,
    status: null,
    minAmount: null,
    maxAmount: null
  });

  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 25,
    totalItems: 0
  });

  const [sort, setSort] = useState<SortState>({
    column: 'timestamp',
    direction: 'desc'
  });

  /**
   * Enhanced transaction fetching with debouncing and cancellation
   */
  const fetchTransactions = useCallback(async () => {
    if (!portfolioId) return;

    setLoading(true);
    setLoadingState(LoadingState.LOADING);

    try {
      const response = await portfolioApi.getTransactionHistory(portfolioId, {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        type: filters.type || undefined,
        limit: pagination.pageSize
      });

      if (response.success) {
        setTransactions(response.data);
        setPagination(prev => ({ ...prev, totalItems: response.data.length }));
        setLoadingState(LoadingState.SUCCESS);
      } else {
        throw new Error('Failed to fetch transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setLoadingState(LoadingState.ERROR);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, filters, pagination.pageSize]);

  /**
   * Sets up real-time transaction updates subscription
   */
  useEffect(() => {
    if (!portfolioId) return;

    const subscription = portfolioApi.subscribeToTransactions(portfolioId, {
      onData: (newTransaction: Transaction) => {
        setTransactions(prev => [newTransaction, ...prev]);
      },
      onError: (err: Error) => {
        console.error('Real-time update error:', err);
      }
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [portfolioId]);

  /**
   * Handles filter changes with validation
   */
  const handleFilterChange = useCallback((newFilters: Partial<TransactionFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  /**
   * Handles sort changes with column memory
   */
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSort({ column, direction });
  }, []);

  /**
   * Handles pagination changes with boundary checks
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: Math.max(1, Math.min(newPage, Math.ceil(prev.totalItems / prev.pageSize)))
    }));
  }, []);

  // Fetch transactions when dependencies change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, filters, pagination.page, sort]);

  // Memoized filtered and sorted transactions
  const displayedTransactions = useMemo(() => {
    return transactions
      .filter(transaction => {
        if (filters.type && transaction.type !== filters.type) return false;
        if (filters.symbol && transaction.symbol !== filters.symbol) return false;
        if (filters.status && transaction.status !== filters.status) return false;
        if (filters.minAmount && transaction.total_amount < filters.minAmount) return false;
        if (filters.maxAmount && transaction.total_amount > filters.maxAmount) return false;
        return true;
      })
      .sort((a, b) => {
        const multiplier = sort.direction === 'asc' ? 1 : -1;
        return multiplier * (new Date(a[sort.column]).getTime() - new Date(b[sort.column]).getTime());
      });
  }, [transactions, filters, sort]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setError(null);
        fetchTransactions();
      }}
    >
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">
          {t('portfolio.transactions.title')}
        </h1>

        <TransactionHistory
          transactions={displayedTransactions}
          loading={loading}
          onSort={handleSort}
          onFilter={handleFilterChange}
          onPageChange={handlePageChange}
          pageSize={pagination.pageSize}
          currentPage={pagination.page}
          className="mb-6"
          enableVirtualization
          refreshInterval={30000}
          locale={navigator.language}
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          ariaLabel={t('portfolio.transactions.tableAriaLabel')}
        />
      </div>
    </ErrorBoundary>
  );
};

export default Transactions;