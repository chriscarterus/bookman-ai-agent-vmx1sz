/**
 * Authentication Reducer Test Suite
 * @version 1.0.0
 * @description Comprehensive test suite for authentication reducer validating
 * secure state management, MFA flows, session handling, and token refresh operations
 */

// External imports - @jest/globals ^29.6.0
import { describe, it, expect, beforeEach } from '@jest/globals';

// Internal imports
import { authReducer, initialState } from '../../../src/store/reducers/auth.reducer';
import { 
  loginUser,
  verifyMfa,
  refreshToken
} from '../../../src/store/actions/auth.actions';
import { ApiError, ErrorSeverity } from '../../../src/types/api.types';
import { AuthState, User } from '../../../src/types/store.types';

describe('authReducer', () => {
  let mockInitialState: AuthState;

  // Mock user data
  const mockUser: User = {
    id: 'test-user-123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'USER',
    preferences: {
      theme: 'light',
      language: 'en-US',
      timezone: 'UTC',
      marketDataInterval: '1h',
      notifications: {
        email: true,
        push: true,
        priceAlerts: true,
        securityAlerts: true,
        newsAlerts: true
      }
    },
    lastLogin: new Date().toISOString()
  };

  // Mock API error
  const mockError: ApiError = {
    code: 'AUTH_ERROR',
    message: 'Authentication failed',
    details: {},
    severity: ErrorSeverity.ERROR
  };

  beforeEach(() => {
    mockInitialState = { ...initialState };
  });

  describe('Initial State', () => {
    it('should return the initial state', () => {
      const state = authReducer(undefined, { type: '@@INIT' });
      expect(state).toEqual(initialState);
    });
  });

  describe('Login Flow', () => {
    it('should handle login.pending', () => {
      const state = authReducer(mockInitialState, loginUser.pending(''));
      expect(state).toEqual({
        ...mockInitialState,
        loading: true,
        error: null,
        mfaRequired: false
      });
    });

    it('should handle successful login without MFA', () => {
      const successPayload: AuthState = {
        isAuthenticated: true,
        user: mockUser,
        loading: false,
        error: null,
        mfaRequired: false,
        sessionExpiry: Date.now() + 3600000,
        lastActivity: Date.now(),
        tokenRefreshInProgress: false
      };

      const state = authReducer(mockInitialState, loginUser.fulfilled(successPayload, '', {
        email: 'test@example.com',
        password: 'password'
      }));

      expect(state).toEqual(successPayload);
    });

    it('should handle login with MFA required', () => {
      const mfaPayload: AuthState = {
        ...mockInitialState,
        mfaRequired: true,
        loading: false,
        error: null,
        lastActivity: expect.any(Number)
      };

      const state = authReducer(mockInitialState, loginUser.fulfilled(mfaPayload, '', {
        email: 'test@example.com',
        password: 'password'
      }));

      expect(state).toEqual(mfaPayload);
    });

    it('should handle login failure', () => {
      const state = authReducer(mockInitialState, loginUser.rejected(null, '', {
        email: 'test@example.com',
        password: 'password'
      }, mockError));

      expect(state).toEqual({
        ...mockInitialState,
        loading: false,
        error: mockError,
        isAuthenticated: false,
        user: null
      });
    });
  });

  describe('MFA Verification Flow', () => {
    it('should handle verifyMfa.pending', () => {
      const state = authReducer(mockInitialState, verifyMfa.pending(''));
      expect(state).toEqual({
        ...mockInitialState,
        loading: true,
        error: null
      });
    });

    it('should handle successful MFA verification', () => {
      const mfaSuccessPayload: AuthState = {
        isAuthenticated: true,
        user: mockUser,
        loading: false,
        error: null,
        mfaRequired: false,
        sessionExpiry: Date.now() + 3600000,
        lastActivity: Date.now(),
        tokenRefreshInProgress: false
      };

      const state = authReducer(
        { ...mockInitialState, mfaRequired: true },
        verifyMfa.fulfilled(mfaSuccessPayload, '', { code: '123456' })
      );

      expect(state).toEqual(mfaSuccessPayload);
    });

    it('should handle MFA verification failure', () => {
      const state = authReducer(
        { ...mockInitialState, mfaRequired: true },
        verifyMfa.rejected(null, '', { code: '123456' }, mockError)
      );

      expect(state).toEqual({
        ...mockInitialState,
        mfaRequired: true,
        loading: false,
        error: mockError
      });
    });
  });

  describe('Token Refresh Flow', () => {
    it('should handle refreshToken.pending', () => {
      const state = authReducer(mockInitialState, refreshToken.pending(''));
      expect(state).toEqual({
        ...mockInitialState,
        tokenRefreshInProgress: true,
        error: null
      });
    });

    it('should handle successful token refresh', () => {
      const refreshSuccessPayload: AuthState = {
        isAuthenticated: true,
        user: mockUser,
        loading: false,
        error: null,
        mfaRequired: false,
        sessionExpiry: Date.now() + 3600000,
        lastActivity: Date.now(),
        tokenRefreshInProgress: false
      };

      const state = authReducer(
        { ...mockInitialState, isAuthenticated: true, user: mockUser },
        refreshToken.fulfilled(refreshSuccessPayload, '')
      );

      expect(state).toEqual(refreshSuccessPayload);
    });

    it('should handle token refresh failure', () => {
      const state = authReducer(
        { ...mockInitialState, isAuthenticated: true, user: mockUser },
        refreshToken.rejected(null, '', undefined, mockError)
      );

      expect(state).toEqual({
        ...mockInitialState,
        isAuthenticated: false,
        user: null,
        tokenRefreshInProgress: false,
        error: mockError,
        sessionExpiry: 0
      });
    });
  });

  describe('Session Management', () => {
    it('should handle session activity update', () => {
      const currentTime = Date.now();
      const state = authReducer(mockInitialState, {
        type: 'auth/updateActivity'
      });

      expect(state.lastActivity).toBeGreaterThanOrEqual(currentTime);
    });

    it('should handle session timeout check with expired session', () => {
      const expiredState = {
        ...mockInitialState,
        isAuthenticated: true,
        user: mockUser,
        sessionExpiry: Date.now() - 1000 // Expired session
      };

      const state = authReducer(expiredState, {
        type: 'auth/checkSession'
      });

      expect(state).toEqual({
        ...initialState,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          details: {},
          severity: 'WARNING'
        },
        lastActivity: expect.any(Number)
      });
    });

    it('should handle session timeout check with valid session', () => {
      const validState = {
        ...mockInitialState,
        isAuthenticated: true,
        user: mockUser,
        sessionExpiry: Date.now() + 3600000 // Valid session
      };

      const state = authReducer(validState, {
        type: 'auth/checkSession'
      });

      expect(state).toEqual(validState);
    });
  });
});