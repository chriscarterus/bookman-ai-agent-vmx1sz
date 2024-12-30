// External imports
import { AxiosResponse } from 'axios'; // ^1.4.0 - HTTP client response types

// Global constants
export const API_VERSION = 'v1';
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_TIMEOUT = 30000;
export const API_ENDPOINTS = {
  AUTH: '/auth',
  MARKET: '/market',
  PORTFOLIO: '/portfolio',
  LEARNING: '/learning'
} as const;

// Loading state enum for component states
export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// Error severity levels
export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Base props interface for API-connected components
export interface ApiComponentProps {
  className?: string;
  loading: boolean;
  error?: ApiError;
  retryCount: number;
  loadingState: LoadingState;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
  timestamp: string;
  requestId: string;
}

// Enhanced error type for API responses
export interface ApiError {
  code: string;
  message: string;
  details: Record<string, any>;
  severity: ErrorSeverity;
  stack?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Market data response type
export interface MarketDataResponse {
  symbol: string;
  price: number;
  timestamp: string;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
}

// Authentication response type
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
}

// User role enumeration
export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  PREMIUM = 'PREMIUM',
  ADMIN = 'ADMIN',
  SECURITY = 'SECURITY'
}

// Retry configuration for API requests
export interface RetryConfig {
  maxRetries: number;
  backoffFactor: number;
  retryableStatusCodes: number[];
  timeout: number;
}

// Security headers configuration
export interface SecurityHeaders {
  'X-API-Key'?: string;
  'X-Request-ID': string;
  'X-Client-Version': string;
  'X-Device-ID': string;
}

// API request configuration
export interface ApiRequestConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  withCredentials: boolean;
  retryConfig: RetryConfig;
  securityHeaders: SecurityHeaders;
}

// Pagination parameters
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Generic API error response type
export type ApiErrorResponse = AxiosResponse<ApiResponse<never>>;

// API endpoint configuration type
export type ApiEndpointConfig = typeof API_ENDPOINTS;

// Role-based permission type
export type RolePermission = {
  [K in UserRole]: string[];
};

// API method types
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// HTTP status codes type
export type HttpStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 500;

// API version type
export type ApiVersionType = typeof API_VERSION;

// Export everything as named exports for better tree-shaking
export type {
  ApiErrorResponse,
  ApiEndpointConfig,
  RolePermission,
  ApiMethod,
  HttpStatusCode,
  ApiVersionType
};