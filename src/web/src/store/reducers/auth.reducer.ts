/**
 * Authentication Reducer for Bookman AI Platform
 * @version 1.0.0
 * @description Redux reducer for managing authentication state, session management, and MFA flows
 */

// External imports
import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { AuthState } from '../../types/store.types';
import { ApiError } from '../../types/api.types';
import { AuthActions } from '../actions/auth.actions';

/**
 * Initial authentication state with security defaults
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  mfaRequired: false,
  sessionExpiry: 0,
  lastActivity: Date.now(),
  tokenRefreshInProgress: false
};

/**
 * Enhanced authentication reducer with comprehensive security features
 */
const authReducer = createReducer(initialState, (builder) => {
  builder
    // Login flow
    .addCase(AuthActions.loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.mfaRequired = false;
    })
    .addCase(AuthActions.loginUser.fulfilled, (state, action: PayloadAction<AuthState>) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.mfaRequired = action.payload.mfaRequired;
      state.sessionExpiry = action.payload.sessionExpiry;
      state.lastActivity = Date.now();
      state.loading = false;
      state.error = null;
    })
    .addCase(AuthActions.loginUser.rejected, (state, action: PayloadAction<ApiError>) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.error = {
        code: action.payload.code,
        message: action.payload.message,
        details: action.payload.details,
        severity: action.payload.severity
      };
    })

    // MFA verification flow
    .addCase(AuthActions.verifyMfa.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(AuthActions.verifyMfa.fulfilled, (state, action: PayloadAction<AuthState>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.mfaRequired = false;
      state.sessionExpiry = action.payload.sessionExpiry;
      state.lastActivity = Date.now();
      state.loading = false;
      state.error = null;
    })
    .addCase(AuthActions.verifyMfa.rejected, (state, action: PayloadAction<ApiError>) => {
      state.loading = false;
      state.error = {
        code: action.payload.code,
        message: action.payload.message,
        details: action.payload.details,
        severity: action.payload.severity
      };
    })

    // Token refresh flow
    .addCase(AuthActions.refreshUserToken.pending, (state) => {
      state.tokenRefreshInProgress = true;
      state.error = null;
    })
    .addCase(AuthActions.refreshUserToken.fulfilled, (state, action: PayloadAction<AuthState>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.sessionExpiry = action.payload.sessionExpiry;
      state.lastActivity = Date.now();
      state.tokenRefreshInProgress = false;
      state.error = null;
    })
    .addCase(AuthActions.refreshUserToken.rejected, (state, action: PayloadAction<ApiError>) => {
      state.tokenRefreshInProgress = false;
      state.isAuthenticated = false;
      state.user = null;
      state.sessionExpiry = 0;
      state.error = {
        code: action.payload.code,
        message: action.payload.message,
        details: action.payload.details,
        severity: action.payload.severity
      };
    })

    // Logout flow
    .addCase(AuthActions.logoutUser.pending, (state) => {
      state.loading = true;
    })
    .addCase(AuthActions.logoutUser.fulfilled, (state) => {
      return {
        ...initialState,
        lastActivity: Date.now()
      };
    })
    .addCase(AuthActions.logoutUser.rejected, (state) => {
      // Force logout even on error for security
      return {
        ...initialState,
        lastActivity: Date.now()
      };
    })

    // Session activity update
    .addCase('auth/updateActivity', (state) => {
      state.lastActivity = Date.now();
    })

    // Session timeout check
    .addCase('auth/checkSession', (state) => {
      const now = Date.now();
      if (state.isAuthenticated && state.sessionExpiry > 0 && now >= state.sessionExpiry) {
        return {
          ...initialState,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired. Please log in again.',
            details: {},
            severity: 'WARNING'
          },
          lastActivity: now
        };
      }
    });
});

/**
 * Selector for authentication state
 */
export const selectAuthState = (state: { auth: AuthState }): AuthState => state.auth;

/**
 * Export reducer and initial state
 */
export { authReducer, initialState };