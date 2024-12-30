/**
 * @fileoverview Redux reducer for cryptocurrency market data management
 * @version 1.0.0
 * @license MIT
 */

// External imports - v1.9.5
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { MarketState } from '../../types/store.types';
import { MarketData } from '../../types/market.types';
import { 
  fetchMarketData, 
  fetchPricePrediction, 
  updateMarketData 
} from '../actions/market.actions';

/**
 * Maximum age of market data before considered stale (in milliseconds)
 */
const MAX_DATA_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * Maximum number of symbols to store in state
 */
const MAX_SYMBOLS = 100;

/**
 * Initial state for market data management
 */
const initialState: MarketState = {
  data: {},
  loading: false,
  error: null,
  lastUpdated: 0,
  websocketStatus: 'disconnected',
  predictionData: {},
  dataValidationErrors: []
};

/**
 * Market data slice with enhanced error handling and data validation
 */
const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    /**
     * Updates websocket connection status
     */
    setWebsocketStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting'>) => {
      state.websocketStatus = action.payload;
    },

    /**
     * Cleans up stale market data
     */
    cleanupStaleData: (state) => {
      const now = Date.now();
      Object.keys(state.data).forEach(symbol => {
        if (now - state.data[symbol].timestamp > MAX_DATA_AGE) {
          delete state.data[symbol];
        }
      });
    },

    /**
     * Validates and updates market data for a specific symbol
     */
    validateAndUpdateMarket: (state, action: PayloadAction<MarketData>) => {
      const { symbol, price, volume, change_24h } = action.payload;
      
      // Validate data
      if (price < 0 || volume < 0) {
        state.dataValidationErrors.push({
          symbol,
          error: 'Invalid price or volume values',
          timestamp: Date.now()
        });
        return;
      }

      // Update data with validation
      state.data[symbol] = {
        ...action.payload,
        price: Number(price),
        volume: Number(volume),
        change_24h: Number(change_24h),
        timestamp: Date.now()
      };
      state.lastUpdated = Date.now();
    }
  },
  extraReducers: (builder) => {
    // Handle fetchMarketData actions
    builder
      .addCase(fetchMarketData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarketData.fulfilled, (state, action) => {
        state.loading = false;
        // Process and validate incoming data
        action.payload.forEach(marketData => {
          if (Object.keys(state.data).length >= MAX_SYMBOLS) {
            // Remove oldest data if limit reached
            const oldestSymbol = Object.keys(state.data)
              .sort((a, b) => state.data[a].timestamp - state.data[b].timestamp)[0];
            delete state.data[oldestSymbol];
          }
          
          state.data[marketData.symbol] = {
            ...marketData,
            timestamp: Date.now()
          };
        });
        state.lastUpdated = Date.now();
      })
      .addCase(fetchMarketData.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          code: 'MARKET_DATA_FETCH_ERROR',
          message: action.error.message || 'Failed to fetch market data',
          details: {},
          severity: 'ERROR'
        };
      })

      // Handle real-time market data updates
      .addCase(updateMarketData, (state, action) => {
        const { symbol, price, volume, change_24h } = action.payload;
        
        // Validate incoming data
        if (price <= 0 || volume < 0) {
          state.dataValidationErrors.push({
            symbol,
            error: 'Invalid market data values',
            timestamp: Date.now()
          });
          return;
        }

        state.data[symbol] = {
          ...action.payload,
          timestamp: Date.now()
        };
        state.lastUpdated = Date.now();
      })

      // Handle price prediction actions
      .addCase(fetchPricePrediction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPricePrediction.fulfilled, (state, action) => {
        state.loading = false;
        const { symbol } = action.payload;
        state.predictionData[symbol] = {
          ...action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchPricePrediction.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          code: 'PREDICTION_FETCH_ERROR',
          message: action.error.message || 'Failed to fetch price prediction',
          details: {},
          severity: 'ERROR'
        };
      });
  }
});

// Export actions and reducer
export const { 
  setWebsocketStatus, 
  cleanupStaleData, 
  validateAndUpdateMarket 
} = marketSlice.actions;

export default marketSlice.reducer;