/**
 * Authentication Actions for Bookman AI Platform
 * @version 1.0.0
 * @description Redux action creators for authentication operations with enhanced security,
 * MFA support, and comprehensive session management
 */

// External imports
import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { authService } from '../../services/auth.service';
import type { AppThunk } from '../../types/store.types';
import type { AuthState } from '../../types/store.types';
import type { ApiError } from '../../types/api.types';

// Constants for action types
const AUTH_FEATURE_KEY = 'auth';

/**
 * Interface for login credentials
 */
interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

/**
 * Enhanced login action with MFA support and security features
 */
export const loginUser = createAsyncThunk<
  AuthState,
  LoginCredentials,
  { rejectValue: ApiError }
>(
  `${AUTH_FEATURE_KEY}/login`,
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      // Initial login attempt
      const response = await authService.login(
        credentials.email,
        credentials.password,
        credentials.rememberMe
      );

      // Handle MFA challenge if required
      if (response.mfa_required && !credentials.mfaCode) {
        return {
          isAuthenticated: false,
          user: null,
          mfaRequired: true,
          sessionExpiry: 0,
          loading: false,
          error: null,
          lastActivity: Date.now()
        };
      }

      // Validate MFA if provided
      if (response.mfa_required && credentials.mfaCode) {
        await authService.validateMFA(credentials.mfaCode);
      }

      // Encrypt and store tokens securely
      const encryptedToken = await authService.encryptToken(response.accessToken);
      localStorage.setItem('encrypted_token', encryptedToken);

      return {
        isAuthenticated: true,
        user: response.user,
        mfaRequired: false,
        sessionExpiry: Date.now() + (response.expiresIn * 1000),
        loading: false,
        error: null,
        lastActivity: Date.now()
      };
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
        details: error.details || {},
        severity: error.severity || 'ERROR'
      });
    }
  }
);

/**
 * Enhanced logout action with secure cleanup
 */
export const logoutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: ApiError }
>(
  `${AUTH_FEATURE_KEY}/logout`,
  async (_, { rejectWithValue }) => {
    try {
      // Perform secure logout
      await authService.logout();

      // Clear secure storage
      localStorage.removeItem('encrypted_token');
      sessionStorage.clear();

      // Broadcast logout event for cross-tab synchronization
      window.dispatchEvent(new Event('auth:logout'));

      // Clear any scheduled token refreshes
      if (window.tokenRefreshTimer) {
        clearInterval(window.tokenRefreshTimer);
      }

    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
        details: error.details || {},
        severity: error.severity || 'ERROR'
      });
    }
  }
);

/**
 * Enhanced token refresh action with retry mechanism
 */
export const refreshUserToken = createAsyncThunk<
  AuthState,
  void,
  { rejectValue: ApiError }
>(
  `${AUTH_FEATURE_KEY}/refresh`,
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.refreshToken();

      // Encrypt and store new tokens
      const encryptedToken = await authService.encryptToken(response.accessToken);
      localStorage.setItem('encrypted_token', encryptedToken);

      return {
        isAuthenticated: true,
        user: response.user,
        mfaRequired: false,
        sessionExpiry: Date.now() + (response.expiresIn * 1000),
        loading: false,
        error: null,
        lastActivity: Date.now()
      };
    } catch (error: any) {
      // Handle token refresh failure
      if (error.code === 'TOKEN_EXPIRED') {
        // Force logout on token expiration
        await logoutUser();
      }

      return rejectWithValue({
        code: error.code || 'REFRESH_ERROR',
        message: error.message || 'Token refresh failed',
        details: error.details || {},
        severity: error.severity || 'ERROR'
      });
    }
  }
);

// Declare global window type for token refresh timer
declare global {
  interface Window {
    tokenRefreshTimer?: NodeJS.Timeout;
  }
}

/**
 * Helper function to schedule token refresh
 */
export const scheduleTokenRefresh = (expiresIn: number): AppThunk => {
  return async (dispatch) => {
    // Clear existing timer if any
    if (window.tokenRefreshTimer) {
      clearInterval(window.tokenRefreshTimer);
    }

    // Schedule refresh for 5 minutes before expiration
    const refreshTime = (expiresIn * 1000) - (5 * 60 * 1000);
    window.tokenRefreshTimer = setInterval(() => {
      dispatch(refreshUserToken());
    }, refreshTime);
  };
};

// Export action creators
export const authActions = {
  loginUser,
  logoutUser,
  refreshUserToken,
  scheduleTokenRefresh
};