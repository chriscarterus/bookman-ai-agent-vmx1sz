/**
 * Portfolio Redux Actions
 * @version 1.0.0
 * @description Redux action creators for portfolio management with enhanced security and real-time features
 */

// External imports
import { createAction, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import retry from 'redux-retry-middleware'; // ^1.0.0

// Internal imports
import { Portfolio, Asset } from '../../types/portfolio.types';
import { portfolioApi } from '../../api/portfolio';
import { ErrorSeverity } from '../../types/api.types';

/**
 * Action type constants
 */
export const PORTFOLIO_ACTIONS = {
  FETCH_PORTFOLIOS: 'portfolio/fetchPortfolios',
  CREATE_PORTFOLIO: 'portfolio/createPortfolio',
  UPDATE_PORTFOLIO: 'portfolio/updatePortfolio',
  DELETE_PORTFOLIO: 'portfolio/deletePortfolio',
  ADD_ASSET: 'portfolio/addAsset',
  UPDATE_REAL_TIME_PRICE: 'portfolio/updateRealTimePrice',
  VALIDATE_SMART_CONTRACT: 'portfolio/validateSmartContract',
  FETCH_PERFORMANCE: 'portfolio/fetchPerformance'
} as const;

/**
 * Retry configuration for failed API calls
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 5000
};

/**
 * Fetch user portfolios with performance metrics
 */
export const fetchPortfolios = createAsyncThunk(
  PORTFOLIO_ACTIONS.FETCH_PORTFOLIOS,
  async ({ userId, includeMetrics = true }: { userId: string; includeMetrics?: boolean }, { rejectWithValue }) => {
    try {
      const portfolioResponse = await portfolioApi.getPortfolioSummary(userId);
      
      if (includeMetrics) {
        const portfoliosWithMetrics = await Promise.all(
          portfolioResponse.data.map(async (portfolio) => {
            const metrics = await portfolioApi.getPortfolioPerformance(portfolio.portfolio_id);
            return { ...portfolio, performance_metrics: metrics.data };
          })
        );
        return portfoliosWithMetrics;
      }
      
      return portfolioResponse.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

/**
 * Create new portfolio with security validation
 */
export const createPortfolio = createAsyncThunk(
  PORTFOLIO_ACTIONS.CREATE_PORTFOLIO,
  async (portfolio: Partial<Portfolio>, { rejectWithValue }) => {
    try {
      const response = await portfolioApi.addAsset(portfolio.portfolio_id!, {
        ...portfolio,
        created_at: new Date(),
        updated_at: new Date()
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

/**
 * Add asset with smart contract validation
 */
export const addAsset = createAsyncThunk(
  PORTFOLIO_ACTIONS.ADD_ASSET,
  async ({ 
    portfolioId, 
    asset, 
    contractAddress 
  }: { 
    portfolioId: string; 
    asset: Partial<Asset>; 
    contractAddress?: string;
  }, { rejectWithValue }) => {
    try {
      // Validate smart contract if provided
      if (contractAddress) {
        const validationResponse = await portfolioApi.validateSmartContract(contractAddress);
        if (!validationResponse.data.isValid) {
          return rejectWithValue({
            code: 'INVALID_CONTRACT',
            message: 'Smart contract validation failed',
            severity: ErrorSeverity.ERROR
          });
        }
      }

      // Get real-time price for asset
      const priceResponse = await portfolioApi.getRealTimePrice(asset.symbol!);
      const assetWithPrice = {
        ...asset,
        current_price: priceResponse.data.price,
        last_updated: new Date()
      };

      const response = await portfolioApi.addAsset(portfolioId, assetWithPrice);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

/**
 * Update real-time asset prices
 */
export const updateRealTimePrice = createAsyncThunk(
  PORTFOLIO_ACTIONS.UPDATE_REAL_TIME_PRICE,
  async ({ portfolioId, assets }: { portfolioId: string; assets: Asset[] }, { rejectWithValue }) => {
    try {
      const updatedAssets = await Promise.all(
        assets.map(async (asset) => {
          const priceResponse = await portfolioApi.getRealTimePrice(asset.symbol);
          return {
            ...asset,
            current_price: priceResponse.data.price,
            total_value: asset.quantity * priceResponse.data.price,
            profit_loss: (priceResponse.data.price - asset.average_buy_price) * asset.quantity,
            profit_loss_percentage: ((priceResponse.data.price - asset.average_buy_price) / asset.average_buy_price) * 100,
            last_updated: new Date()
          };
        })
      );

      return {
        portfolioId,
        assets: updatedAssets
      };
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

/**
 * Fetch portfolio performance metrics
 */
export const fetchPerformance = createAsyncThunk(
  PORTFOLIO_ACTIONS.FETCH_PERFORMANCE,
  async ({ 
    portfolioId, 
    timeframe = '24h' 
  }: { 
    portfolioId: string; 
    timeframe?: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  }, { rejectWithValue }) => {
    try {
      const response = await portfolioApi.getPortfolioPerformance(portfolioId, timeframe);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

/**
 * Validate smart contract security
 */
export const validateSmartContract = createAsyncThunk(
  PORTFOLIO_ACTIONS.VALIDATE_SMART_CONTRACT,
  async (contractAddress: string, { rejectWithValue }) => {
    try {
      const response = await portfolioApi.validateSmartContract(contractAddress);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code,
        message: error.message,
        severity: ErrorSeverity.ERROR
      });
    }
  }
);

// Export all actions
export const portfolioActions = {
  fetchPortfolios,
  createPortfolio,
  addAsset,
  updateRealTimePrice,
  fetchPerformance,
  validateSmartContract
};