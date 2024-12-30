/**
 * Root Redux Store Configuration
 * @version 1.0.0
 * @description Configures the global Redux store with enhanced middleware, 
 * performance optimizations, and comprehensive type safety for the Bookman AI platform.
 */

// External imports - v1.9.5
import { 
  configureStore, 
  combineReducers,
  getDefaultMiddleware,
  Middleware
} from '@reduxjs/toolkit';

// Internal imports - Reducers
import { authReducer } from './reducers/auth.reducer';
import { marketReducer } from './reducers/market.reducer';
import { portfolioReducer } from './reducers/portfolio.reducer';
import { uiReducer } from './reducers/ui.reducer';

// Internal types
import type { RootState } from '../types/store.types';

/**
 * Custom middleware for performance monitoring
 */
const performanceMiddleware: Middleware = () => (next) => (action) => {
  const start = performance.now();
  const result = next(action);
  const end = performance.now();
  const duration = end - start;

  if (duration > 16) { // Log slow actions (taking more than one frame)
    console.warn(`Slow action: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

/**
 * Custom middleware for action validation
 */
const validationMiddleware: Middleware = () => (next) => (action) => {
  if (!action.type) {
    console.error('Action type is missing:', action);
    return;
  }
  return next(action);
};

/**
 * Creates the root reducer with enhanced type safety
 */
const createRootReducer = () => {
  return combineReducers<RootState>({
    auth: authReducer,
    market: marketReducer,
    portfolio: portfolioReducer,
    ui: uiReducer
  });
};

/**
 * Redux store configuration with performance optimizations
 */
const configureAppStore = () => {
  // Development tools configuration
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Configure default middleware with performance settings
  const middleware = getDefaultMiddleware({
    thunk: true,
    immutableCheck: isDevelopment,
    serializableCheck: {
      ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      ignoredPaths: ['market.websocket', 'portfolio.connection']
    },
    // Increase performance in production
    ...(!isDevelopment && {
      immutableCheck: false,
      serializableCheck: false
    })
  });

  // Add custom middleware
  middleware.push(performanceMiddleware);
  if (isDevelopment) {
    middleware.push(validationMiddleware);
  }

  // Configure store with all enhancements
  const store = configureStore({
    reducer: createRootReducer(),
    middleware,
    devTools: isDevelopment && {
      name: 'Bookman AI Platform',
      maxAge: 50,
      trace: true,
      traceLimit: 25,
      actionSanitizer: (action) => ({
        ...action,
        // Remove sensitive data from actions in dev tools
        ...(action.payload?.password && { payload: { ...action.payload, password: '[FILTERED]' } })
      })
    },
    preloadedState: undefined,
    enhancers: []
  });

  // Enable hot module replacement for reducers in development
  if (isDevelopment && module.hot) {
    module.hot.accept('./reducers', () => {
      store.replaceReducer(createRootReducer());
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Export store singleton and types
export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;
export { RootState };

// Type-safe hooks for consuming components
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Helper function to reset entire store state
 * Useful for logout or critical errors
 */
export const resetStore = () => {
  store.dispatch({ type: 'RESET_STORE' });
};

/**
 * Helper function to get current state snapshot
 * Warning: Use selectors instead for components
 */
export const getStoreSnapshot = (): RootState => store.getState();

// Export everything as named exports
export {
  store as default,
  configureAppStore,
  createRootReducer,
  resetStore,
  getStoreSnapshot
};