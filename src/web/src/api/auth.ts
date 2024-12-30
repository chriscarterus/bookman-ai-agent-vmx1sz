/**
 * Authentication API Client for Bookman AI Platform
 * @version 1.0.0
 * @description Implements secure authentication endpoints with MFA support, device fingerprinting, and enhanced security features
 */

// External imports
import { AxiosResponse } from 'axios'; // ^1.4.0

// Internal imports
import { AuthResponse, ApiError } from '../types/api.types';
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS, ERROR_CODES } from '../constants/api.constants';

// Types for authentication
interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
  deviceInfo: DeviceInfo;
}

interface RegistrationData {
  email: string;
  password: string;
  username: string;
  deviceInfo: DeviceInfo;
}

interface DeviceInfo {
  platform: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  setupToken: string;
}

/**
 * Generates device fingerprint for enhanced security
 * @param deviceInfo Device information for fingerprinting
 * @returns Hashed device fingerprint
 */
const generateDeviceFingerprint = (deviceInfo: DeviceInfo): string => {
  const fingerprint = JSON.stringify({
    ...deviceInfo,
    timestamp: Date.now(),
    random: Math.random().toString(36)
  });
  
  // Use SubtleCrypto for secure hashing when available
  if (window.crypto && window.crypto.subtle) {
    return window.crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(fingerprint))
      .then(buffer => Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
  }
  
  // Fallback to basic hashing
  return btoa(fingerprint);
};

/**
 * Authenticates user with email, password and optional MFA token
 * @param credentials User login credentials and device info
 * @returns Promise resolving to authentication response
 * @throws ApiError on authentication failure
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const deviceFingerprint = await generateDeviceFingerprint(credentials.deviceInfo);
    
    const response: AxiosResponse<AuthResponse> = await apiClient.post(
      API_ENDPOINTS.AUTH.LOGIN,
      {
        email: credentials.email,
        password: credentials.password,
        mfaToken: credentials.mfaToken,
        deviceFingerprint
      },
      {
        headers: {
          'X-Device-Fingerprint': deviceFingerprint,
          'X-Login-Timestamp': Date.now().toString()
        }
      }
    );

    // Store tokens securely
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }

    return response.data;
  } catch (error) {
    throw handleAuthError(error as ApiError);
  }
};

/**
 * Registers a new user with enhanced security measures
 * @param registrationData User registration data and device info
 * @returns Promise resolving to authentication response
 * @throws ApiError on registration failure
 */
export const register = async (registrationData: RegistrationData): Promise<AuthResponse> => {
  try {
    const deviceFingerprint = await generateDeviceFingerprint(registrationData.deviceInfo);
    
    // Validate password strength
    if (!isPasswordStrong(registrationData.password)) {
      throw new Error('Password does not meet security requirements');
    }

    const response: AxiosResponse<AuthResponse> = await apiClient.post(
      API_ENDPOINTS.AUTH.REGISTER,
      {
        email: registrationData.email,
        password: registrationData.password,
        username: registrationData.username,
        deviceFingerprint
      },
      {
        headers: {
          'X-Device-Fingerprint': deviceFingerprint,
          'X-Registration-Timestamp': Date.now().toString()
        }
      }
    );

    return response.data;
  } catch (error) {
    throw handleAuthError(error as ApiError);
  }
};

/**
 * Sets up Multi-Factor Authentication for user account
 * @param userId User ID for MFA setup
 * @param mfaType Type of MFA (authenticator/sms)
 * @returns Promise resolving to MFA setup response
 * @throws ApiError on MFA setup failure
 */
export const setupMFA = async (
  userId: string,
  mfaType: 'authenticator' | 'sms'
): Promise<MFASetupResponse> => {
  try {
    const response: AxiosResponse<MFASetupResponse> = await apiClient.post(
      API_ENDPOINTS.AUTH.MFA,
      {
        userId,
        mfaType
      }
    );

    return response.data;
  } catch (error) {
    throw handleAuthError(error as ApiError);
  }
};

/**
 * Validates MFA token during authentication
 * @param userId User ID for validation
 * @param mfaToken MFA token to validate
 * @returns Promise resolving to validation status
 * @throws ApiError on validation failure
 */
export const validateMFAToken = async (
  userId: string,
  mfaToken: string
): Promise<boolean> => {
  try {
    const response: AxiosResponse<{ valid: boolean }> = await apiClient.post(
      `${API_ENDPOINTS.AUTH.MFA}/validate`,
      {
        userId,
        mfaToken
      }
    );

    return response.data.valid;
  } catch (error) {
    throw handleAuthError(error as ApiError);
  }
};

/**
 * Handles authentication-specific errors
 * @param error API error to handle
 * @returns Enhanced API error with auth context
 */
const handleAuthError = (error: ApiError): ApiError => {
  const enhancedError: ApiError = {
    code: error.code || ERROR_CODES.UNAUTHORIZED.code.toString(),
    message: error.message || ERROR_CODES.UNAUTHORIZED.message,
    details: {
      ...error.details,
      timestamp: new Date().toISOString(),
      context: 'authentication'
    },
    severity: error.severity
  };

  // Log authentication errors for security monitoring
  console.error('Authentication Error:', {
    ...enhancedError,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  return enhancedError;
};

/**
 * Validates password strength against security requirements
 * @param password Password to validate
 * @returns Boolean indicating password strength
 */
const isPasswordStrong = (password: string): boolean => {
  const minLength = 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChars
  );
};