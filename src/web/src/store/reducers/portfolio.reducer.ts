/**
 * Portfolio Redux Reducer
 * @version 1.0.0
 * @description Manages portfolio state with multi-wallet support, real-time updates, and performance tracking
 */

// External imports - v1.9.5
import { createReducer } from '@reduxjs/toolkit';
// External imports - v6.0.0
import { persistReducer } from 'redux-persist';

// Internal imports
import { Portfolio } from '../../types/portfolio.types';
import { portfolioActions } from '../actions/portfolio.actions';
import { ErrorSeverity } from '../../types/api.types';

/**
 * Portfolio state interface with comprehensive tracking
 */
interface PortfolioState {
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  loading: boolean;
  error: {
    code?: string;
    message?: string;
    severity?: ErrorSeverity;
  } | null;
  performanceCache: {
    [portfolioId: string]: {
      data: any;
      timestamp: number;
    };
  };
  lastUpdated: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  walletConnections: {
    address: string;
    chainId: number;
    status: 'connected' | 'disconnected' | 'error';
  }[];
}

/**
 * Cache duration for performance data (5 minutes)
 */
const CACHE_DURATION = 300000;

/**
 * Initial state configuration
 */
const initialState: PortfolioState = {
  portfolios: [],
  selectedPortfolio: null,
  loading: false,
  error: null,
  performanceCache: {},
  lastUpdated: null,
  syncStatus: 'idle',
  walletConnections: []
};

/**
 * Portfolio reducer with enhanced features and optimizations
 */
const reducer = createReducer(initialState, (builder) => {
  builder
    // Fetch portfolios
    .addCase(portfolioActions.fetchPortfolios.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(portfolioActions.fetchPortfolios.fulfilled, (state, action) => {
      state.loading = false;
      state.portfolios = action.payload;
      state.lastUpdated = new Date().toISOString();
    })
    .addCase(portfolioActions.fetchPortfolios.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code,
        message: action.error.message,
        severity: ErrorSeverity.ERROR
      };
    })

    // Create portfolio
    .addCase(portfolioActions.createPortfolio.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(portfolioActions.createPortfolio.fulfilled, (state, action) => {
      state.loading = false;
      state.portfolios.push(action.payload);
      state.lastUpdated = new Date().toISOString();
    })
    .addCase(portfolioActions.createPortfolio.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code,
        message: action.error.message,
        severity: ErrorSeverity.ERROR
      };
    })

    // Add asset
    .addCase(portfolioActions.addAsset.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(portfolioActions.addAsset.fulfilled, (state, action) => {
      state.loading = false;
      const portfolioIndex = state.portfolios.findIndex(
        p => p.portfolio_id === action.payload.portfolioId
      );
      if (portfolioIndex !== -1) {
        state.portfolios[portfolioIndex].assets.push(action.payload.asset);
        state.lastUpdated = new Date().toISOString();
      }
    })
    .addCase(portfolioActions.addAsset.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code,
        message: action.error.message,
        severity: ErrorSeverity.ERROR
      };
    })

    // Update real-time prices
    .addCase(portfolioActions.updateRealTimePrice.pending, (state) => {
      state.syncStatus = 'syncing';
    })
    .addCase(portfolioActions.updateRealTimePrice.fulfilled, (state, action) => {
      const { portfolioId, assets } = action.payload;
      const portfolioIndex = state.portfolios.findIndex(
        p => p.portfolio_id === portfolioId
      );
      if (portfolioIndex !== -1) {
        state.portfolios[portfolioIndex].assets = assets;
        state.lastUpdated = new Date().toISOString();
      }
      state.syncStatus = 'idle';
    })
    .addCase(portfolioActions.updateRealTimePrice.rejected, (state) => {
      state.syncStatus = 'error';
    })

    // Fetch performance
    .addCase(portfolioActions.fetchPerformance.fulfilled, (state, action) => {
      const { portfolioId, data } = action.payload;
      state.performanceCache[portfolioId] = {
        data,
        timestamp: Date.now()
      };
    })

    // Validate smart contract
    .addCase(portfolioActions.validateSmartContract.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(portfolioActions.validateSmartContract.fulfilled, (state) => {
      state.loading = false;
    })
    .addCase(portfolioActions.validateSmartContract.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code,
        message: action.error.message,
        severity: ErrorSeverity.ERROR
      };
    });
});

/**
 * Persistence configuration for portfolio state
 */
const persistConfig = {
  key: 'portfolio',
  storage: localStorage,
  whitelist: ['portfolios', 'selectedPortfolio', 'walletConnections'],
  blacklist: ['loading', 'error', 'performanceCache', 'syncStatus']
};

/**
 * Export configured portfolio reducer with persistence
 */
export const portfolioReducer = persistReducer(persistConfig, reducer);

/**
 * Selectors for accessing portfolio state
 */
export const selectPortfolios = (state: { portfolio: PortfolioState }) => 
  state.portfolio.portfolios;

export const selectSelectedPortfolio = (state: { portfolio: PortfolioState }) => 
  state.portfolio.selectedPortfolio;

export const selectPortfolioPerformance = (portfolioId: string) => 
  (state: { portfolio: PortfolioState }) => {
    const cached = state.portfolio.performanceCache[portfolioId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  };

export const selectPortfolioLoadingState = (state: { portfolio: PortfolioState }) => ({
  loading: state.portfolio.loading,
  error: state.portfolio.error,
  syncStatus: state.portfolio.syncStatus
});

export const selectWalletConnections = (state: { portfolio: PortfolioState }) => 
  state.portfolio.walletConnections;