/**
 * API Constants for Bookman AI Platform
 * @version 1.0.0
 * @description Defines API endpoint constants and configuration values for the Bookman AI platform frontend
 */

// Global API Configuration
export const API_VERSION = "v1";
export const API_TIMEOUT = 30000;
export const MAX_RETRIES = 3;
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://api.bookman.ai";
export const DEFAULT_LOCALE = "en-US";

/**
 * Comprehensive API endpoint constants for all platform services
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY_EMAIL: '/auth/verify-email',
    RESET_PASSWORD: '/auth/reset-password',
    MFA: '/auth/mfa'
  },
  MARKET: {
    PRICES: '/market/prices',
    TRENDS: '/market/trends',
    ANALYSIS: '/market/analysis',
    ALERTS: '/market/alerts',
    HISTORICAL: '/market/historical',
    PREDICTIONS: '/market/predictions'
  },
  PORTFOLIO: {
    SUMMARY: '/portfolio/summary',
    ASSETS: '/portfolio/assets',
    TRANSACTIONS: '/portfolio/transactions',
    PERFORMANCE: '/portfolio/performance',
    ANALYTICS: '/portfolio/analytics'
  },
  EDUCATION: {
    COURSES: '/education/courses',
    MODULES: '/education/modules',
    PROGRESS: '/education/progress',
    QUIZZES: '/education/quizzes',
    CERTIFICATES: '/education/certificates'
  },
  SECURITY: {
    SCAN: '/security/scan',
    ALERTS: '/security/alerts',
    AUDIT: '/security/audit',
    REPORTS: '/security/reports',
    SETTINGS: '/security/settings'
  },
  COMMUNITY: {
    FORUMS: '/community/forums',
    POSTS: '/community/posts',
    COMMENTS: '/community/comments',
    EXPERTS: '/community/experts',
    WEBINARS: '/community/webinars'
  }
} as const;

/**
 * HTTP method constants for API requests
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;

/**
 * Common API header constants for requests
 */
export const API_HEADERS = {
  CONTENT_TYPE: 'application/json',
  AUTHORIZATION: 'Bearer',
  ACCEPT: 'application/json',
  ACCEPT_LANGUAGE: DEFAULT_LOCALE,
  X_API_VERSION: API_VERSION,
  X_REQUEST_ID: 'x-request-id'
} as const;

/**
 * API error code constants with messages
 */
export const ERROR_CODES = {
  UNAUTHORIZED: {
    code: 401,
    message: 'Authentication required'
  },
  FORBIDDEN: {
    code: 403,
    message: 'Access denied'
  },
  NOT_FOUND: {
    code: 404,
    message: 'Resource not found'
  },
  VALIDATION_ERROR: {
    code: 422,
    message: 'Invalid input data'
  },
  SERVER_ERROR: {
    code: 500,
    message: 'Internal server error'
  },
  SERVICE_UNAVAILABLE: {
    code: 503,
    message: 'Service temporarily unavailable'
  }
} as const;

/**
 * Pagination and sorting default values
 */
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
  SORT_ORDER: {
    ASC: 'asc',
    DESC: 'desc'
  },
  CURSOR_DEFAULTS: {
    LIMIT: 50,
    ORDER: 'desc',
    TIMESTAMP_FIELD: 'created_at'
  }
} as const;

// Type definitions for better TypeScript support
export type ApiEndpoint = typeof API_ENDPOINTS;
export type HttpMethod = keyof typeof HTTP_METHODS;
export type ErrorCode = keyof typeof ERROR_CODES;
export type SortOrder = keyof typeof PAGINATION_DEFAULTS.SORT_ORDER;

/**
 * Utility type for API response pagination
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  cursor?: string;
  limit?: number;
}