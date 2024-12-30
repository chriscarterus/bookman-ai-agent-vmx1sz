/**
 * usePortfolio Custom Hook
 * @version 1.0.0
 * @description Custom React hook for managing portfolio state and operations with enhanced security,
 * real-time updates, and smart contract validation in the Bookman AI platform
 */

// External imports - v8.1.2 for react-redux, v18.2.0 for react, v4.0.11 for react-error-boundary
import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';

// Internal imports
import { Portfolio, Asset } from '../types/portfolio.types';
import { portfolioActions } from '../store/actions/portfolio.actions';
import { LoadingState, ErrorSeverity, ApiError } from '../types/api.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// WebSocket connection for real-time updates
const WEBSOCKET_URL = `${process.env.VITE_WS_URL || 'wss://api.bookman.ai'}/portfolio`;

/**
 * Custom hook for managing portfolio operations
 * @param portfolioId - The ID of the portfolio to manage
 */
export const usePortfolio = (portfolioId: string) => {
  // Redux setup
  const dispatch = useDispatch();
  const { showBoundary } = useErrorBoundary();

  // Local state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // Select portfolio from Redux store
  const portfolio = useSelector((state: any) => 
    state.portfolios.entities[portfolioId]
  );

  /**
   * Initialize WebSocket connection for real-time updates
   */
  const initializeWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket(`${WEBSOCKET_URL}/${portfolioId}`);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'PRICE_UPDATE') {
        dispatch(portfolioActions.updateRealTimePrice({
          portfolioId,
          assets: data.assets
        }));
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Real-time connection failed');
    };

    return () => {
      wsRef.current?.close();
    };
  }, [portfolioId, dispatch]);

  /**
   * Fetch portfolio data with error handling
   */
  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingState(LoadingState.LOADING);
      
      await dispatch(portfolioActions.fetchPortfolios({ 
        userId: portfolio?.user_id,
        includeMetrics: true 
      }));
      
      setLoadingState(LoadingState.SUCCESS);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLoadingState(LoadingState.ERROR);
      showBoundary(err);
    } finally {
      setLoading(false);
    }
  }, [dispatch, portfolio?.user_id, showBoundary]);

  /**
   * Update portfolio with optimistic updates
   */
  const updatePortfolio = useCallback(async (updates: Partial<Portfolio>) => {
    try {
      setLoadingState(LoadingState.LOADING);
      
      // Optimistic update
      dispatch(portfolioActions.updatePortfolio({
        portfolioId,
        updates: {
          ...updates,
          updated_at: new Date()
        }
      }));

      await dispatch(portfolioActions.fetchPortfolios({ 
        userId: portfolio?.user_id 
      }));
      
      setLoadingState(LoadingState.SUCCESS);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLoadingState(LoadingState.ERROR);
      showBoundary(err);
    }
  }, [dispatch, portfolioId, portfolio?.user_id, showBoundary]);

  /**
   * Add asset with smart contract validation
   */
  const addAsset = useCallback(async (assetData: Partial<Asset>) => {
    try {
      setLoadingState(LoadingState.LOADING);

      // Validate smart contract if provided
      if (assetData.smart_contract_address) {
        const validationResult = await dispatch(portfolioActions.validateSmartContract(
          assetData.smart_contract_address
        ));
        
        if (!validationResult.payload.isValid) {
          throw new Error('Smart contract validation failed');
        }
      }

      await dispatch(portfolioActions.addAsset({
        portfolioId,
        asset: assetData
      }));

      setLoadingState(LoadingState.SUCCESS);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLoadingState(LoadingState.ERROR);
      showBoundary(err);
    }
  }, [dispatch, portfolioId, showBoundary]);

  /**
   * Remove asset with confirmation
   */
  const removeAsset = useCallback(async (assetId: string) => {
    try {
      setLoadingState(LoadingState.LOADING);

      await dispatch(portfolioActions.updatePortfolio({
        portfolioId,
        updates: {
          assets: portfolio?.assets.filter(asset => asset.asset_id !== assetId)
        }
      }));

      setLoadingState(LoadingState.SUCCESS);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLoadingState(LoadingState.ERROR);
      showBoundary(err);
    }
  }, [dispatch, portfolioId, portfolio?.assets, showBoundary]);

  /**
   * Validate asset data and smart contract
   */
  const validateAsset = useCallback(async (assetData: Partial<Asset>): Promise<boolean> => {
    try {
      if (assetData.smart_contract_address) {
        const validationResult = await dispatch(portfolioActions.validateSmartContract(
          assetData.smart_contract_address
        ));
        return validationResult.payload.isValid;
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      showBoundary(err);
      return false;
    }
  }, [dispatch, showBoundary]);

  /**
   * Refresh asset prices manually
   */
  const refreshPrices = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);

      await dispatch(portfolioActions.updateRealTimePrice({
        portfolioId,
        assets: portfolio?.assets || []
      }));

      setLoadingState(LoadingState.SUCCESS);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLoadingState(LoadingState.ERROR);
      showBoundary(err);
    }
  }, [dispatch, portfolioId, portfolio?.assets, showBoundary]);

  /**
   * Retry failed operations with exponential backoff
   */
  const retryOperation = useCallback(async (operation: () => Promise<void>) => {
    const maxRetries = 3;
    const baseDelay = 1000;
    let retryCount = 0;

    const executeWithRetry = async (): Promise<void> => {
      try {
        await operation();
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry();
        }
        throw err;
      }
    };

    return executeWithRetry();
  }, []);

  // Initialize WebSocket connection and fetch initial data
  useEffect(() => {
    const cleanup = initializeWebSocket();
    fetchPortfolio();
    return cleanup;
  }, [initializeWebSocket, fetchPortfolio]);

  // Return hook interface
  return {
    portfolio,
    loading,
    error,
    loadingState,
    fetchPortfolio,
    updatePortfolio,
    addAsset,
    removeAsset,
    validateAsset,
    refreshPrices,
    retryOperation
  };
};

// Export types for consumers
export type UsePortfolioReturn = ReturnType<typeof usePortfolio>;