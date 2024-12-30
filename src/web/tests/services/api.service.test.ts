/**
 * API Service Test Suite
 * @version 1.0.0
 * @description Comprehensive test suite for the Bookman AI platform API service
 */

// External imports
import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import axios from 'axios'; // ^1.4.0

// Internal imports
import { apiService } from '../../src/services/api.service';
import { apiConfig } from '../../src/config/api.config';
import { API_ENDPOINTS, ERROR_CODES } from '../../src/constants/api.constants';
import { ApiResponse, ErrorSeverity } from '../../src/types/api.types';

// Test setup
let mockAxios: MockAdapter;

beforeEach(() => {
  mockAxios = new MockAdapter(axios);
  localStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  mockAxios.reset();
});

describe('ApiService', () => {
  describe('Request Configuration', () => {
    it('should include required security headers in requests', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      mockAxios.onGet(testUrl).reply((config) => {
        expect(config.headers).toHaveProperty('X-Client-Version');
        expect(config.headers).toHaveProperty('X-Request-ID');
        expect(config.headers).toHaveProperty('X-Request-Time');
        return [200, { data: 'test' }];
      });

      await apiService.get(API_ENDPOINTS.MARKET.PRICES);
    });

    it('should add authorization header when token exists', async () => {
      const testToken = 'test-token';
      localStorage.setItem('accessToken', testToken);

      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.PORTFOLIO.SUMMARY}`;
      mockAxios.onGet(testUrl).reply((config) => {
        expect(config.headers.Authorization).toBe(`Bearer ${testToken}`);
        return [200, { data: 'test' }];
      });

      await apiService.get(API_ENDPOINTS.PORTFOLIO.SUMMARY);
    });
  });

  describe('Response Handling', () => {
    it('should transform successful responses to ApiResponse format', async () => {
      const testData = { key: 'value' };
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      
      mockAxios.onGet(testUrl).reply(200, testData);

      const response = await apiService.get<typeof testData>(API_ENDPOINTS.MARKET.PRICES);

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data', testData);
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('requestId');
    });

    it('should cache GET responses when successful', async () => {
      const testData = { key: 'value' };
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      
      mockAxios.onGet(testUrl).replyOnce(200, testData);

      // First request
      await apiService.get(API_ENDPOINTS.MARKET.PRICES);
      
      // Second request should use cache
      const cachedResponse = await apiService.get(API_ENDPOINTS.MARKET.PRICES);
      
      expect(mockAxios.history.get.length).toBe(1); // Only one actual request
      expect(cachedResponse.data).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with proper format', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      mockAxios.onGet(testUrl).networkError();

      try {
        await apiService.get(API_ENDPOINTS.MARKET.PRICES);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toHaveProperty('code', ERROR_CODES.SERVER_ERROR.code.toString());
        expect(error).toHaveProperty('severity', ErrorSeverity.ERROR);
        expect(error.details).toHaveProperty('url');
        expect(error.details).toHaveProperty('method');
        expect(error.details).toHaveProperty('timestamp');
      }
    });

    it('should handle API errors with proper format', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      mockAxios.onGet(testUrl).reply(404, {
        code: ERROR_CODES.NOT_FOUND.code.toString(),
        message: ERROR_CODES.NOT_FOUND.message
      });

      try {
        await apiService.get(API_ENDPOINTS.MARKET.PRICES);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toHaveProperty('code', ERROR_CODES.NOT_FOUND.code.toString());
        expect(error).toHaveProperty('message', ERROR_CODES.NOT_FOUND.message);
      }
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      mockAxios.onGet(testUrl).reply(500);

      // Generate failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await apiService.get(API_ENDPOINTS.MARKET.PRICES);
        } catch (error) {
          // Expected errors
        }
      }

      try {
        await apiService.get(API_ENDPOINTS.MARKET.PRICES);
        fail('Should have thrown circuit breaker error');
      } catch (error: any) {
        expect(error.message).toBe('Circuit breaker is open');
      }
    });

    it('should reset circuit breaker after successful request', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      
      // Mock successful request
      mockAxios.onGet(testUrl).reply(200, { data: 'test' });

      await apiService.get(API_ENDPOINTS.MARKET.PRICES);
      const metrics = apiService.getMetrics();

      expect(metrics.circuitBreakerStatus.failures).toBe(0);
      expect(metrics.circuitBreakerStatus.isOpen).toBe(false);
    });
  });

  describe('Pagination', () => {
    it('should handle paginated requests correctly', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.PORTFOLIO.ASSETS}`;
      const paginationParams = {
        page: 1,
        pageSize: 20,
        sortBy: 'timestamp',
        sortOrder: 'desc' as const
      };

      mockAxios.onGet(testUrl).reply((config) => {
        expect(config.params).toEqual(paginationParams);
        return [200, { data: [] }];
      });

      await apiService.getPaginated(API_ENDPOINTS.PORTFOLIO.ASSETS, paginationParams);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request duration', async () => {
      const testUrl = `${apiConfig.baseURL}${API_ENDPOINTS.MARKET.PRICES}`;
      const debugSpy = jest.spyOn(console, 'debug');

      mockAxios.onGet(testUrl).reply(200, { data: 'test' });

      await apiService.get(API_ENDPOINTS.MARKET.PRICES);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Request to'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });
});