/**
 * @fileoverview Redux store type definitions for Bookman AI platform
 * @version 1.0.0
 * @license MIT
 */

// External imports
import { Action, ThunkAction } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { ApiError, ErrorSeverity } from '../types/api.types';
import { MarketData } from '../types/market.types';
import { Portfolio } from '../types/portfolio.types';

/**
 * User interface for authentication state
 */
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'GUEST' | 'USER' | 'PREMIUM' | 'ADMIN' | 'SECURITY';
  preferences: UserPreferences;
  lastLogin: string;
}

/**
 * User preferences interface for UI customization
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  marketDataInterval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  notifications: NotificationPreferences;
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  priceAlerts: boolean;
  securityAlerts: boolean;
  newsAlerts: boolean;
}

/**
 * Notification interface for UI state
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

/**
 * Authentication state interface
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  lastActivity: number;
}

/**
 * Market data state interface with real-time updates
 */
export interface MarketState {
  data: Record<string, MarketData>;
  loading: boolean;
  error: ApiError | null;
  lastUpdated: number;
  websocketStatus: 'connected' | 'disconnected' | 'connecting';
}

/**
 * Portfolio management state interface
 */
export interface PortfolioState {
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  loading: boolean;
  error: ApiError | null;
  lastSync: number;
}

/**
 * UI state interface for theme and preferences
 */
export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  notifications: Notification[];
  preferences: UserPreferences;
}

/**
 * Root state interface combining all feature states
 */
export interface RootState {
  auth: AuthState;
  market: MarketState;
  portfolio: PortfolioState;
  ui: UIState;
}

/**
 * Type-safe thunk action creator
 * R: Return type of the thunk
 */
export type AppThunk<R = void> = ThunkAction<
  Promise<R>,
  RootState,
  unknown,
  Action<string>
>;

/**
 * Loading states for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * WebSocket connection states
 */
export type WebSocketState = 'connected' | 'disconnected' | 'connecting';

/**
 * Market data subscription type
 */
export interface MarketDataSubscription {
  symbol: string;
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  callback: (data: MarketData) => void;
}

/**
 * Error state interface with metadata
 */
export interface ErrorState {
  code: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: number;
  retryCount?: number;
}

/**
 * Session state interface for auth management
 */
export interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  lastRefresh: number | null;
}

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  text: string;
  isDark: boolean;
}

/**
 * Chart configuration interface
 */
export interface ChartConfig {
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  indicators: string[];
  showVolume: boolean;
  showGrid: boolean;
}

/**
 * Portfolio filter interface
 */
export interface PortfolioFilter {
  search: string;
  sortBy: 'name' | 'value' | 'performance';
  sortOrder: 'asc' | 'desc';
  assetType: string[];
}