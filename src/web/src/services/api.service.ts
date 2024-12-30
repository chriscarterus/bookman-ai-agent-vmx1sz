/**
 * Core API Service for Bookman AI Platform
 * @version 1.0.0
 * @description Provides centralized HTTP client functionality with enhanced security,
 * monitoring, and error handling capabilities for the Bookman AI platform
 */

// External imports
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0

// Internal imports
import { apiConfig } from '../config/api.config';
import { 
  ApiResponse, 
  ApiError, 
  ErrorSeverity,
  LoadingState,
  PaginationParams 
} from '../types/api.types';
import { API_ENDPOINTS, ERROR_CODES } from '../constants/api.constants';

// Performance monitoring
import { performance } from 'perf_hooks';

/**
 * Circuit breaker state interface
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

/**
 * Request cache interface
 */
interface RequestCache {
  [key: string]: {
    data: any;
    timestamp: number;
    expiresIn: number;
  };
}

/**
 * Enhanced API Service class with comprehensive features
 */
class ApiService {
  private readonly axiosInstance: AxiosInstance;
  private readonly cache: RequestCache = {};
  private readonly circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false
  };
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 30 * 1000; // 30 seconds

  constructor() {
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  /**
   * Creates an enhanced Axios instance with base configuration
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0'
      },
      withCredentials: true
    });

    return instance;
  }

  /**
   * Configures request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        return this.handleRequest(config);
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return this.handleResponse(response);
      },
      async (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Enhanced request handler with security and monitoring features
   */
  private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open');
    }

    // Add correlation ID
    const correlationId = crypto.randomUUID();
    config.headers = {
      ...config.headers,
      'X-Correlation-ID': correlationId,
      'X-Request-Time': Date.now().toString()
    };

    // Add authentication token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add security headers
    config.headers = {
      ...config.headers,
      ...apiConfig.securityHeaders
    };

    return config;
  }

  /**
   * Enhanced response handler with caching and monitoring
   */
  private handleResponse(response: AxiosResponse): ApiResponse<any> {
    // Calculate request duration
    const requestTime = parseInt(response.config.headers['X-Request-Time']);
    const duration = Date.now() - requestTime;

    // Log performance metrics
    this.logPerformanceMetrics(response.config.url!, duration);

    // Reset circuit breaker on successful response
    this.resetCircuitBreaker();

    // Format response
    const apiResponse: ApiResponse<any> = {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
      requestId: response.config.headers['X-Correlation-ID']
    };

    // Cache successful GET requests
    if (response.config.method?.toUpperCase() === 'GET') {
      this.cacheResponse(response.config.url!, apiResponse);
    }

    return apiResponse;
  }

  /**
   * Comprehensive error handler with retry logic
   */
  private handleError(error: any): ApiError {
    // Increment circuit breaker failures
    this.incrementCircuitBreaker();

    const apiError: ApiError = {
      code: error.response?.status?.toString() || ERROR_CODES.SERVER_ERROR.code.toString(),
      message: error.response?.data?.message || ERROR_CODES.SERVER_ERROR.message,
      details: {
        url: error.config?.url,
        method: error.config?.method,
        timestamp: new Date().toISOString()
      },
      severity: ErrorSeverity.ERROR
    };

    // Log error for monitoring
    console.error('API Error:', {
      ...apiError,
      stack: error.stack
    });

    return apiError;
  }

  /**
   * Makes a GET request with caching support
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    // Check cache first
    const cachedResponse = this.getCachedResponse(url);
    if (cachedResponse) {
      return cachedResponse;
    }

    return this.axiosInstance.get(url, config);
  }

  /**
   * Makes a POST request
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.axiosInstance.post(url, data, config);
  }

  /**
   * Makes a PUT request
   */
  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.axiosInstance.put(url, data, config);
  }

  /**
   * Makes a DELETE request
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.axiosInstance.delete(url, config);
  }

  /**
   * Handles paginated requests
   */
  public async getPaginated<T>(url: string, params: PaginationParams): Promise<ApiResponse<T[]>> {
    const config: AxiosRequestConfig = {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      }
    };

    return this.get<T[]>(url, config);
  }

  /**
   * Caches successful responses
   */
  private cacheResponse(url: string, response: ApiResponse<any>): void {
    this.cache[url] = {
      data: response,
      timestamp: Date.now(),
      expiresIn: this.CACHE_DURATION
    };
  }

  /**
   * Retrieves cached response if valid
   */
  private getCachedResponse(url: string): ApiResponse<any> | null {
    const cached = this.cache[url];
    if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
      return cached.data;
    }
    return null;
  }

  /**
   * Clears the response cache
   */
  public clearCache(): void {
    this.cache = {};
  }

  /**
   * Circuit breaker implementation
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    const now = Date.now();
    if (now - this.circuitBreaker.lastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
      this.resetCircuitBreaker();
      return false;
    }

    return true;
  }

  private incrementCircuitBreaker(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
  }

  /**
   * Performance monitoring
   */
  private logPerformanceMetrics(url: string, duration: number): void {
    performance.mark(`api-${url}-end`);
    console.debug(`API Request to ${url} completed in ${duration}ms`);
  }

  /**
   * Returns API metrics for monitoring
   */
  public getMetrics(): Record<string, any> {
    return {
      circuitBreakerStatus: this.circuitBreaker,
      cacheSize: Object.keys(this.cache).length,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const apiService = new ApiService();

// Export service instance
export { apiService };

// Export types for consumers
export type { ApiResponse, ApiError, PaginationParams };