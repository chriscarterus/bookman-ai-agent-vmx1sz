/**
 * API Utilities Module for Bookman AI Platform
 * @version 1.0.0
 * @description Comprehensive utility functions for API operations including request/response formatting,
 * error handling, security validation, and data transformation
 */

// External imports
import axios, { AxiosResponse, AxiosError } from 'axios'; // ^1.5.0

// Internal imports
import { 
  ApiResponse, 
  ApiError, 
  ErrorSeverity,
  LoadingState
} from '../types/api.types';
import { apiConfig } from '../config/api.config';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../constants/api.constants';

/**
 * Interface for validation options
 */
interface ValidationOptions {
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  customValidators?: ((value: any) => boolean)[];
}

/**
 * Interface for validation results
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  securityFlags?: string[];
}

/**
 * Formats API responses into standardized format with enhanced tracking
 * @param response - Axios response object
 * @returns Standardized API response with tracking information
 */
export function formatApiResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
  const requestId = response.headers['x-request-id'] || crypto.randomUUID();
  const requestStart = parseInt(response.config.headers['x-request-start'] as string);
  const requestDuration = Date.now() - requestStart;

  const formattedResponse: ApiResponse<T> = {
    success: response.status >= 200 && response.status < 300,
    data: response.data,
    timestamp: new Date().toISOString(),
    requestId,
    error: undefined,
    metadata: {
      statusCode: response.status,
      duration: requestDuration,
      path: response.config.url,
      method: response.config.method?.toUpperCase()
    }
  };

  // Log response metrics for monitoring
  console.debug('API Response Metrics:', {
    requestId,
    duration: requestDuration,
    status: response.status,
    endpoint: response.config.url
  });

  return formattedResponse;
}

/**
 * Formats API errors into standardized format with severity and tracking
 * @param error - Axios error object
 * @returns Standardized error response
 */
export function formatApiError<T>(error: AxiosError): ApiResponse<T> {
  const correlationId = crypto.randomUUID();
  const errorResponse = error.response?.data as ApiError;
  
  const standardError: ApiError = {
    code: errorResponse?.code || ERROR_CODES.SERVER_ERROR.code.toString(),
    message: errorResponse?.message || ERROR_CODES.SERVER_ERROR.message,
    severity: determineSeverity(error),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    correlationId,
    details: {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    }
  };

  // Log error for monitoring
  console.error('API Error:', {
    correlationId,
    error: standardError,
    originalError: error
  });

  return {
    success: false,
    data: {} as T,
    error: standardError,
    timestamp: new Date().toISOString(),
    requestId: error.config?.headers['x-request-id'] as string || correlationId
  };
}

/**
 * Determines error severity based on status code and error type
 * @param error - Axios error object
 * @returns Error severity level
 */
function determineSeverity(error: AxiosError): ErrorSeverity {
  const status = error.response?.status;
  
  if (!status) return ErrorSeverity.CRITICAL;
  
  switch (true) {
    case status >= 500:
      return ErrorSeverity.CRITICAL;
    case status === 401 || status === 403:
      return ErrorSeverity.ERROR;
    case status === 429:
      return ErrorSeverity.WARNING;
    default:
      return ErrorSeverity.INFO;
  }
}

/**
 * Validates request data with comprehensive security checks
 * @param data - Data to validate
 * @param options - Validation options
 * @returns Validation result with security flags
 */
export function validateRequestData(
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const securityFlags: string[] = [];

  // Type check
  if (data === null || data === undefined) {
    errors.push('Data is required');
    return { isValid: false, errors, securityFlags };
  }

  // Required fields check
  if (options.required && Object.keys(data as object).length === 0) {
    errors.push('Required fields are missing');
  }

  // Length validation
  if (typeof data === 'string') {
    if (options.maxLength && data.length > options.maxLength) {
      errors.push(`Exceeds maximum length of ${options.maxLength}`);
    }
    if (options.minLength && data.length < options.minLength) {
      errors.push(`Below minimum length of ${options.minLength}`);
    }
  }

  // Pattern validation
  if (options.pattern && typeof data === 'string' && !options.pattern.test(data)) {
    errors.push('Invalid format');
  }

  // Security checks
  if (typeof data === 'string') {
    // XSS check
    if (/<script|javascript:/i.test(data)) {
      securityFlags.push('Potential XSS detected');
      errors.push('Invalid characters detected');
    }

    // SQL Injection check
    if (/(\b(select|insert|update|delete|drop|union)\b)/i.test(data)) {
      securityFlags.push('Potential SQL injection detected');
      errors.push('Invalid input detected');
    }
  }

  // Custom validators
  if (options.customValidators) {
    options.customValidators.forEach((validator, index) => {
      if (!validator(data)) {
        errors.push(`Custom validation ${index + 1} failed`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    securityFlags
  };
}

/**
 * Builds URL query parameters with security encoding
 * @param params - Query parameters object
 * @returns Encoded query string
 */
export function buildQueryParams(params: Record<string, any>): string {
  // Filter out null/undefined values
  const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  // Handle pagination defaults
  if ('pageSize' in filteredParams) {
    filteredParams.pageSize = Math.min(
      parseInt(filteredParams.pageSize),
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE
    );
  }

  // Convert to URLSearchParams
  const searchParams = new URLSearchParams();
  
  Object.entries(filteredParams).forEach(([key, value]) => {
    // Sanitize and encode values
    const sanitizedValue = typeof value === 'string' 
      ? encodeURIComponent(value.replace(/[<>]/g, ''))
      : value;
      
    searchParams.append(key, String(sanitizedValue));
  });

  return searchParams.toString();
}

/**
 * Type guard to check if a value is an API error
 * @param value - Value to check
 * @returns Boolean indicating if value is an API error
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'severity' in value
  );
}