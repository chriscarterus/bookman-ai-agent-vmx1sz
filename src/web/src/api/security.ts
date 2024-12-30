/**
 * Security API Client for Bookman AI Platform
 * @version 1.0.0
 * @description Frontend API client for security-related operations including fraud detection,
 * smart contract auditing, and security alerts management with enhanced security features
 */

// External imports
import axios, { AxiosError } from 'axios'; // ^1.4.0

// Internal imports
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  ApiResponse, 
  PaginatedResponse, 
  ErrorSeverity,
  LoadingState 
} from '../types/api.types';

// Type definitions for security-related requests and responses
interface FraudDetectionRequest {
  transactionHash: string;
  walletAddress: string;
  amount: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface FraudDetectionResponse {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  findings: Array<{
    type: string;
    severity: ErrorSeverity;
    description: string;
    recommendation?: string;
  }>;
  timestamp: string;
}

interface SmartContractAuditRequest {
  contractAddress: string;
  chainId: number;
  sourceCode: string;
  compilerVersion?: string;
  optimizationEnabled?: boolean;
}

interface SmartContractAuditResponse {
  vulnerabilities: Array<{
    id: string;
    type: string;
    severity: ErrorSeverity;
    location: string;
    description: string;
    recommendation: string;
  }>;
  gasAnalysis: {
    totalGasUsed: number;
    optimizationSuggestions: string[];
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  auditId: string;
  timestamp: string;
}

interface SecurityAlert {
  id: string;
  type: string;
  severity: ErrorSeverity;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface GetAlertsRequest {
  page: number;
  pageSize: number;
  severity?: ErrorSeverity[];
  status?: string[];
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UpdateAlertRequest {
  status: SecurityAlert['status'];
  resolution?: string;
  assignee?: string;
}

/**
 * Sends transaction data for fraud detection analysis
 * @param request - Transaction details for fraud analysis
 * @returns Promise with fraud detection results
 */
export async function detectFraud(
  request: FraudDetectionRequest
): Promise<ApiResponse<FraudDetectionResponse>> {
  try {
    // Validate request parameters
    if (!request.transactionHash || !request.walletAddress) {
      throw new Error('Missing required parameters for fraud detection');
    }

    // Add security headers and encrypt sensitive data
    const headers = {
      'X-Transaction-Hash': request.transactionHash,
      'X-Request-Timestamp': new Date().toISOString()
    };

    const response = await apiClient.post<ApiResponse<FraudDetectionResponse>>(
      API_ENDPOINTS.SECURITY.SCAN,
      request,
      { headers }
    );

    return response.data;
  } catch (error) {
    handleSecurityError(error as AxiosError);
    throw error;
  }
}

/**
 * Submits smart contract code for security audit
 * @param request - Smart contract details for audit
 * @returns Promise with audit results
 */
export async function auditSmartContract(
  request: SmartContractAuditRequest
): Promise<ApiResponse<SmartContractAuditResponse>> {
  try {
    // Validate contract address and source code
    if (!request.contractAddress || !request.sourceCode) {
      throw new Error('Invalid smart contract audit request');
    }

    const response = await apiClient.post<ApiResponse<SmartContractAuditResponse>>(
      API_ENDPOINTS.SECURITY.AUDIT,
      request,
      {
        timeout: 60000, // Extended timeout for contract analysis
        headers: {
          'X-Chain-ID': request.chainId.toString(),
          'X-Contract-Address': request.contractAddress
        }
      }
    );

    return response.data;
  } catch (error) {
    handleSecurityError(error as AxiosError);
    throw error;
  }
}

/**
 * Retrieves paginated security alerts with filtering
 * @param request - Alert filtering and pagination parameters
 * @returns Promise with paginated security alerts
 */
export async function getSecurityAlerts(
  request: GetAlertsRequest
): Promise<ApiResponse<PaginatedResponse<SecurityAlert>>> {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: request.page.toString(),
      pageSize: request.pageSize.toString(),
      ...(request.severity && { severity: request.severity.join(',') }),
      ...(request.status && { status: request.status.join(',') }),
      ...(request.startDate && { startDate: request.startDate }),
      ...(request.endDate && { endDate: request.endDate }),
      ...(request.sortBy && { sortBy: request.sortBy }),
      ...(request.sortOrder && { sortOrder: request.sortOrder })
    });

    const response = await apiClient.get<ApiResponse<PaginatedResponse<SecurityAlert>>>(
      `${API_ENDPOINTS.SECURITY.ALERTS}?${queryParams.toString()}`
    );

    return response.data;
  } catch (error) {
    handleSecurityError(error as AxiosError);
    throw error;
  }
}

/**
 * Updates security alert status with audit trail
 * @param alertId - ID of the alert to update
 * @param request - Alert update details
 * @returns Promise with updated alert
 */
export async function updateAlertStatus(
  alertId: string,
  request: UpdateAlertRequest
): Promise<ApiResponse<SecurityAlert>> {
  try {
    // Validate alert ID and status
    if (!alertId || !request.status) {
      throw new Error('Invalid alert update request');
    }

    const response = await apiClient.put<ApiResponse<SecurityAlert>>(
      `${API_ENDPOINTS.SECURITY.ALERTS}/${alertId}`,
      request,
      {
        headers: {
          'X-Alert-ID': alertId,
          'X-Update-Timestamp': new Date().toISOString()
        }
      }
    );

    return response.data;
  } catch (error) {
    handleSecurityError(error as AxiosError);
    throw error;
  }
}

/**
 * Enhanced error handler for security-related operations
 * @param error - Axios error object
 */
function handleSecurityError(error: AxiosError): never {
  const errorResponse = error.response?.data as ApiResponse<never>;
  
  // Log security-related errors for monitoring
  console.error('Security API Error:', {
    endpoint: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    error: errorResponse,
    timestamp: new Date().toISOString()
  });

  throw {
    code: errorResponse?.error?.code || 'SECURITY_ERROR',
    message: errorResponse?.error?.message || 'Security operation failed',
    severity: ErrorSeverity.ERROR,
    details: {
      requestId: error.config?.headers['X-Request-ID'],
      timestamp: new Date().toISOString()
    }
  };
}