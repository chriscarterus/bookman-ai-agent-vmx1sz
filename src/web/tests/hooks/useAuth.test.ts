/**
 * Test Suite for useAuth Hook
 * @version 1.0.0
 * @description Comprehensive tests for authentication, session management, and security features
 */

// External imports - versions specified in package.json
import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { rest } from 'msw'; // ^1.2.1
import { setupServer } from 'msw/node';

// Internal imports
import useAuth from '../../src/hooks/useAuth';
import { authActions } from '../../src/store/actions/auth.actions';
import { API_ENDPOINTS } from '../../src/constants/api.constants';
import type { AuthState, User } from '../../src/types/store.types';
import type { ApiError } from '../../src/types/api.types';

// Mock user data
const mockUser: User = {
  id: 'test-user-id',
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

// Mock API responses
const mockAuthResponse = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  user: mockUser
};

// Setup MSW server for API mocking
const server = setupServer(
  rest.post(`${API_ENDPOINTS.AUTH.LOGIN}`, (req, res, ctx) => {
    return res(ctx.json(mockAuthResponse));
  }),
  rest.post(`${API_ENDPOINTS.AUTH.MFA}`, (req, res, ctx) => {
    return res(ctx.json(mockAuthResponse));
  }),
  rest.post(`${API_ENDPOINTS.AUTH.REFRESH}`, (req, res, ctx) => {
    return res(ctx.json(mockAuthResponse));
  }),
  rest.post(`${API_ENDPOINTS.AUTH.LOGOUT}`, (req, res, ctx) => {
    return res(ctx.status(200));
  })
);

// Initial Redux state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  lastActivity: 0
};

// Configure test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: (state = initialState, action) => {
        switch (action.type) {
          case 'auth/login/pending':
            return { ...state, loading: true };
          case 'auth/login/fulfilled':
            return {
              ...state,
              isAuthenticated: true,
              user: action.payload.user,
              loading: false
            };
          case 'auth/logout/fulfilled':
            return initialState;
          default:
            return state;
        }
      }
    }
  });
};

// Test wrapper component
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={createTestStore()}>{children}</Provider>
);

describe('useAuth Hook', () => {
  // Setup and teardown
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterAll(() => server.close());

  it('should handle initial state correctly', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.mfaRequired).toBe(false);
    expect(result.current.sessionExpiry).toBeNull();
  });

  it('should handle successful login flow', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem('encrypted_token')).toBeTruthy();
  });

  it('should handle MFA challenge correctly', async () => {
    server.use(
      rest.post(`${API_ENDPOINTS.AUTH.LOGIN}`, (req, res, ctx) => {
        return res(ctx.json({ mfa_required: true }));
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(result.current.mfaRequired).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.validateMfa('123456');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.mfaRequired).toBe(false);
  });

  it('should handle session management correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    jest.useFakeTimers();

    // Login and initialize session
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Advance timers to trigger session check
    act(() => {
      jest.advanceTimersByTime(60000); // 1 minute
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate inactivity
    act(() => {
      jest.advanceTimersByTime(1800000); // 30 minutes
    });

    expect(result.current.isAuthenticated).toBe(false);
    
    jest.useRealTimers();
  });

  it('should handle token refresh correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    jest.useFakeTimers();

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Advance time to near token expiry
    act(() => {
      jest.advanceTimersByTime(3300000); // 55 minutes
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('encrypted_token')).toBeTruthy();

    jest.useRealTimers();
  });

  it('should handle logout correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Perform logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('encrypted_token')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('should handle authentication errors correctly', async () => {
    server.use(
      rest.post(`${API_ENDPOINTS.AUTH.LOGIN}`, (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            code: 'AUTH_FAILED',
            message: 'Invalid credentials',
            severity: 'ERROR'
          })
        );
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.code).toBe('AUTH_FAILED');
  });

  it('should handle cross-tab authentication sync', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login in current tab
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Simulate logout in another tab
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth:logout',
        newValue: 'true'
      }));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});