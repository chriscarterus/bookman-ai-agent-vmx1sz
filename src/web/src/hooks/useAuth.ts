/**
 * Enhanced Authentication Hook for Bookman AI Platform
 * @version 1.0.0
 * @description Custom React hook for managing authentication state, MFA flows,
 * and secure session management with comprehensive security features
 */

// External imports - versions specified as per requirements
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useCallback, useEffect } from 'react'; // ^18.2.0

// Internal imports
import { AuthRequest } from '../types/api.types';
import { loginUser, logoutUser } from '../store/actions/auth.actions';
import type { AuthState } from '../types/store.types';

// Constants for session management
const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const SESSION_WARNING_THRESHOLD = 300000; // 5 minutes
const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes

/**
 * Enhanced authentication hook with comprehensive security features
 * @returns {Object} Authentication state and methods
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  
  // Select auth state from Redux store
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  
  /**
   * Enhanced login handler with MFA support
   * @param {AuthRequest} credentials - Login credentials with optional MFA token
   * @returns {Promise<void>}
   */
  const login = useCallback(async (credentials: AuthRequest): Promise<void> => {
    try {
      // Dispatch login action with credentials
      const result = await dispatch(loginUser(credentials)).unwrap();
      
      // Handle MFA requirement
      if (result.mfaRequired && !credentials.mfaToken) {
        // Return early if MFA is required but not provided
        return;
      }

      // Setup session monitoring after successful login
      initializeSessionMonitoring();
      
      // Schedule token refresh
      scheduleTokenRefresh(result.sessionExpiry);
      
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced logout handler with secure cleanup
   * @returns {Promise<void>}
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await dispatch(logoutUser()).unwrap();
      
      // Clear any scheduled tasks
      clearSessionMonitoring();
      
      // Clear sensitive data from memory
      window.sessionStorage.clear();
      
      // Broadcast logout event for cross-tab synchronization
      window.dispatchEvent(new Event('auth:logout'));
      
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Validates MFA token
   * @param {string} mfaToken - MFA verification token
   * @returns {Promise<void>}
   */
  const validateMfa = useCallback(async (mfaToken: string): Promise<void> => {
    try {
      await dispatch(loginUser({ ...authState.user, mfaToken })).unwrap();
    } catch (error) {
      console.error('MFA validation failed:', error);
      throw error;
    }
  }, [dispatch, authState.user]);

  /**
   * Refreshes the current session
   * @returns {Promise<void>}
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const result = await dispatch(loginUser({ refreshToken: true })).unwrap();
      scheduleTokenRefresh(result.sessionExpiry);
    } catch (error) {
      console.error('Session refresh failed:', error);
      await logout();
    }
  }, [dispatch, logout]);

  /**
   * Initializes session monitoring
   */
  const initializeSessionMonitoring = useCallback(() => {
    // Monitor user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleUserActivity = () => {
      if (authState.isAuthenticated) {
        // Update last activity timestamp
        dispatch({ type: 'auth/updateActivity', payload: Date.now() });
      }
    };

    // Attach activity listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Setup session check interval
    const sessionCheckInterval = setInterval(() => {
      if (authState.isAuthenticated) {
        const inactiveTime = Date.now() - authState.lastActivity;
        
        if (inactiveTime >= SESSION_WARNING_THRESHOLD) {
          // Emit session expiry warning
          window.dispatchEvent(new CustomEvent('auth:sessionWarning', {
            detail: { expiresIn: SESSION_WARNING_THRESHOLD - inactiveTime }
          }));
        }
      }
    }, SESSION_CHECK_INTERVAL);

    return () => {
      // Cleanup listeners and intervals
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [authState.isAuthenticated, authState.lastActivity, dispatch]);

  /**
   * Schedules token refresh before expiration
   */
  const scheduleTokenRefresh = useCallback((expiryTime: number) => {
    const refreshTime = expiryTime - Date.now() - TOKEN_REFRESH_BUFFER;
    
    if (refreshTime > 0) {
      setTimeout(async () => {
        try {
          await refreshSession();
        } catch (error) {
          console.error('Token refresh failed:', error);
          await logout();
        }
      }, refreshTime);
    }
  }, [refreshSession, logout]);

  /**
   * Clears session monitoring
   */
  const clearSessionMonitoring = useCallback(() => {
    // Clear any existing intervals
    const intervals = window.setInterval(() => {}, 0);
    for (let i = 0; i < intervals; i++) {
      window.clearInterval(i);
    }
  }, []);

  // Initialize session monitoring on mount
  useEffect(() => {
    if (authState.isAuthenticated) {
      const cleanup = initializeSessionMonitoring();
      return () => {
        cleanup();
        clearSessionMonitoring();
      };
    }
  }, [authState.isAuthenticated, initializeSessionMonitoring, clearSessionMonitoring]);

  // Handle cross-tab authentication
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth:logout') {
        logout();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [logout]);

  // Return authentication interface
  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    mfaRequired: authState.mfaRequired,
    sessionExpiry: authState.sessionExpiry,
    login,
    logout,
    validateMfa,
    refreshSession
  };
};

// Export the hook as default
export default useAuth;