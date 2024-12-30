/**
 * API Configuration for Bookman AI Platform
 * @version 1.0.0
 * @description Configures API client settings with enhanced security, monitoring, and error handling
 */

// External imports
import axios, { AxiosInstance, AxiosError } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0

// Internal imports
import { ApiRequestConfig, ApiError, ErrorSeverity } from '../types/api.types';
import { API_ENDPOINTS, API_HEADERS, ERROR_CODES } from '../constants/api.constants';

// Environment variables and constants
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000;
const API_VERSION = process.env.VITE_API_VERSION || 'v1';
const MAX_RETRIES = 3;

/**
 * Creates enhanced API client configuration with security and monitoring features
 */
const createApiConfig = (): ApiRequestConfig => {
  return {
    baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
    timeout: API_TIMEOUT,
    withCredentials: true,
    headers: {
      [API_HEADERS.CONTENT_TYPE]: 'application/json',
      [API_HEADERS.ACCEPT]: 'application/json',
      [API_HEADERS.X_API_VERSION]: API_VERSION,
      [API_HEADERS.X_REQUEST_ID]: crypto.randomUUID()
    },
    retryConfig: {
      maxRetries: MAX_RETRIES,
      backoffFactor: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      timeout: API_TIMEOUT
    },
    securityHeaders: {
      'X-API-Key': process.env.VITE_API_KEY,
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
      'X-Device-ID': localStorage.getItem('deviceId') || crypto.randomUUID()
    }
  };
};

/**
 * Configures API client with enhanced interceptors, security, and error handling
 */
const configureApiClient = (apiClient: AxiosInstance): void => {
  // Configure retry strategy
  axiosRetry(apiClient, {
    retries: MAX_RETRIES,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error: AxiosError) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429;
    }
  });

  // Request interceptor for authentication and security
  apiClient.interceptors.request.use(
    async (config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `${API_HEADERS.AUTHORIZATION} ${token}`;
      }
      
      // Add security headers
      config.headers = {
        ...config.headers,
        ...apiConfig.securityHeaders
      };

      // Add performance monitoring header
      config.headers['X-Request-Start'] = Date.now().toString();

      return config;
    },
    (error) => Promise.reject(handleApiError(error))
  );

  // Response interceptor for error handling and monitoring
  apiClient.interceptors.response.use(
    (response) => {
      // Calculate and log request duration
      const requestStart = parseInt(response.config.headers['X-Request-Start']);
      const duration = Date.now() - requestStart;
      console.debug(`API Request Duration: ${duration}ms`, {
        url: response.config.url,
        method: response.config.method,
        status: response.status
      });

      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // Handle token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          const response = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH, {
            refreshToken
          });
          
          if (response.data.accessToken) {
            localStorage.setItem('accessToken', response.data.accessToken);
            originalRequest.headers.Authorization = 
              `${API_HEADERS.AUTHORIZATION} ${response.data.accessToken}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          return Promise.reject(handleApiError(refreshError));
        }
      }

      return Promise.reject(handleApiError(error));
    }
  );
};

/**
 * Enhanced error handling with detailed error mapping and logging
 */
const handleApiError = (error: AxiosError): ApiError => {
  const errorResponse = error.response?.data as ApiError;
  
  // Map error to standardized format
  const standardError: ApiError = {
    code: errorResponse?.code || ERROR_CODES.SERVER_ERROR.code.toString(),
    message: errorResponse?.message || ERROR_CODES.SERVER_ERROR.message,
    details: {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    },
    severity: ErrorSeverity.ERROR,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  // Log error for monitoring
  console.error('API Error:', {
    ...standardError,
    originalError: error
  });

  return standardError;
};

// Create API configuration
const apiConfig = createApiConfig();

// Create and configure API client
const apiClient = axios.create(apiConfig);
configureApiClient(apiClient);

// Export configured client and config
export { apiClient, apiConfig };

// Type exports for consumers
export type { ApiError, ApiRequestConfig };