/**
 * Portfolio API Client Module
 * @version 1.0.0
 * @description Handles portfolio management operations with enhanced security, error handling, and reliability
 */

// External imports
import retry from 'axios-retry'; // ^3.5.0
import CircuitBreaker from 'opossum'; // ^7.0.0

// Internal imports
import { apiService } from '../services/api.service';
import { 
  Portfolio, 
  Asset, 
  Transaction, 
  PortfolioPerformance 
} from '../types/portfolio.types';
import { ApiResponse, ErrorSeverity } from '../types/api.types';

/**
 * Portfolio API endpoints
 */
const PORTFOLIO_ENDPOINTS = {
  SUMMARY: '/api/v1/portfolio/summary',
  ASSETS: '/api/v1/portfolio/assets',
  TRANSACTIONS: '/api/v1/portfolio/transactions',
  PERFORMANCE: '/api/v1/portfolio/performance',
  ANALYTICS: '/api/v1/portfolio/analytics'
} as const;

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

/**
 * Request retry configuration
 */
const RETRY_CONFIG = {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error: any) => {
    return retry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429;
  }
};

/**
 * Portfolio API client class with enhanced security and reliability features
 */
class PortfolioApiClient {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly correlationId: string;

  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.executeRequest, CIRCUIT_BREAKER_CONFIG);
    this.correlationId = crypto.randomUUID();
    this.setupCircuitBreakerEvents();
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      console.warn('Portfolio API circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      console.info('Portfolio API circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      console.info('Portfolio API circuit breaker closed');
    });
  }

  /**
   * Executes API request with enhanced error handling
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiService[method](url, data, {
        headers: {
          'X-Correlation-ID': this.correlationId,
          'X-Request-Time': Date.now().toString()
        }
      });

      return response;
    } catch (error: any) {
      console.error('Portfolio API Error:', {
        method,
        url,
        error,
        correlationId: this.correlationId
      });

      throw {
        code: error.response?.status || 500,
        message: error.message,
        severity: ErrorSeverity.ERROR,
        correlationId: this.correlationId
      };
    }
  }

  /**
   * Retrieves user's portfolio summary
   */
  public async getPortfolioSummary(userId: string): Promise<ApiResponse<Portfolio>> {
    return this.circuitBreaker.fire('get', `${PORTFOLIO_ENDPOINTS.SUMMARY}/${userId}`);
  }

  /**
   * Retrieves portfolio assets with optional filtering
   */
  public async getPortfolioAssets(
    portfolioId: string,
    filters?: { symbol?: string; type?: string }
  ): Promise<ApiResponse<Asset[]>> {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${PORTFOLIO_ENDPOINTS.ASSETS}/${portfolioId}${queryParams ? `?${queryParams}` : ''}`;
    return this.circuitBreaker.fire('get', url);
  }

  /**
   * Adds new asset to portfolio
   */
  public async addAsset(portfolioId: string, asset: Partial<Asset>): Promise<ApiResponse<Asset>> {
    return this.circuitBreaker.fire('post', `${PORTFOLIO_ENDPOINTS.ASSETS}/${portfolioId}`, asset);
  }

  /**
   * Updates existing portfolio asset
   */
  public async updateAsset(
    portfolioId: string,
    assetId: string,
    updates: Partial<Asset>
  ): Promise<ApiResponse<Asset>> {
    return this.circuitBreaker.fire(
      'put',
      `${PORTFOLIO_ENDPOINTS.ASSETS}/${portfolioId}/${assetId}`,
      updates
    );
  }

  /**
   * Records new portfolio transaction
   */
  public async recordTransaction(
    portfolioId: string,
    transaction: Partial<Transaction>
  ): Promise<ApiResponse<Transaction>> {
    return this.circuitBreaker.fire(
      'post',
      `${PORTFOLIO_ENDPOINTS.TRANSACTIONS}/${portfolioId}`,
      transaction
    );
  }

  /**
   * Retrieves portfolio transaction history
   */
  public async getTransactionHistory(
    portfolioId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      limit?: number;
    }
  ): Promise<ApiResponse<Transaction[]>> {
    const queryParams = new URLSearchParams(params).toString();
    const url = `${PORTFOLIO_ENDPOINTS.TRANSACTIONS}/${portfolioId}${
      queryParams ? `?${queryParams}` : ''
    }`;
    return this.circuitBreaker.fire('get', url);
  }

  /**
   * Retrieves portfolio performance metrics
   */
  public async getPortfolioPerformance(
    portfolioId: string,
    timeframe: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '24h'
  ): Promise<ApiResponse<PortfolioPerformance>> {
    return this.circuitBreaker.fire(
      'get',
      `${PORTFOLIO_ENDPOINTS.PERFORMANCE}/${portfolioId}?timeframe=${timeframe}`
    );
  }

  /**
   * Retrieves portfolio analytics and insights
   */
  public async getPortfolioAnalytics(
    portfolioId: string
  ): Promise<ApiResponse<PortfolioPerformance>> {
    return this.circuitBreaker.fire('get', `${PORTFOLIO_ENDPOINTS.ANALYTICS}/${portfolioId}`);
  }
}

// Create singleton instance
const portfolioApi = new PortfolioApiClient();

// Export singleton instance
export { portfolioApi };

// Export types for consumers
export type {
  Portfolio,
  Asset,
  Transaction,
  PortfolioPerformance
};