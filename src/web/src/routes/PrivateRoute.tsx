/**
 * Enhanced Private Route Component for Bookman AI Platform
 * @version 1.0.0
 * @description Higher-order component that implements secure route protection with
 * enhanced authentication features including MFA support and session monitoring
 */

// External imports - versions specified for security and compatibility
import { FC, memo, useEffect } from 'react'; // ^18.2.0
import { Navigate } from 'react-router-dom'; // ^6.11.0

// Internal imports
import { useAuth } from '../hooks/useAuth';
import { BaseComponentProps } from '../types/common.types';

/**
 * Props interface for PrivateRoute component extending BaseComponentProps
 * for accessibility support
 */
interface PrivateRouteProps extends BaseComponentProps {
  /** Flag indicating if MFA is required for this route */
  requiresMfa?: boolean;
  /** Path to redirect to if authentication fails */
  fallbackPath?: string;
}

/**
 * Enhanced PrivateRoute component with MFA support and session monitoring
 * @param {PrivateRouteProps} props - Component props
 * @returns {JSX.Element} Protected route content or redirect
 */
const PrivateRoute: FC<PrivateRouteProps> = memo(({
  children,
  requiresMfa = false,
  fallbackPath = '/login',
  ariaLabel,
  dataTestId = 'private-route'
}) => {
  // Get enhanced authentication state from useAuth hook
  const { 
    isAuthenticated,
    loading,
    isMfaRequired,
    sessionStatus,
    refreshSession
  } = useAuth();

  // Monitor session status and handle expiration
  useEffect(() => {
    if (isAuthenticated && sessionStatus) {
      const timeUntilExpiry = sessionStatus.expiresAt - Date.now();
      
      // Refresh session 5 minutes before expiry
      if (timeUntilExpiry > 0 && timeUntilExpiry < 300000) {
        refreshSession().catch(error => {
          console.error('Session refresh failed:', error);
        });
      }
    }
  }, [isAuthenticated, sessionStatus, refreshSession]);

  // Show accessible loading state while checking authentication
  if (loading) {
    return (
      <div 
        role="status"
        aria-label="Verifying authentication"
        data-testid={`${dataTestId}-loading`}
        className="private-route-loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // Redirect to MFA page if MFA is required but not completed
  if (requiresMfa && isMfaRequired) {
    return (
      <Navigate 
        to="/auth/mfa" 
        replace 
        state={{ from: window.location.pathname }}
        aria-label="Redirecting to MFA verification"
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={fallbackPath}
        replace
        state={{ from: window.location.pathname }}
        aria-label="Redirecting to login"
      />
    );
  }

  // Handle session timeout
  if (sessionStatus && !sessionStatus.isActive) {
    return (
      <Navigate 
        to={fallbackPath}
        replace
        state={{ 
          from: window.location.pathname,
          reason: 'session_timeout'
        }}
        aria-label="Session expired, redirecting to login"
      />
    );
  }

  // Render protected route content with accessibility attributes
  return (
    <div 
      role="main"
      aria-label={ariaLabel || 'Protected content'}
      data-testid={dataTestId}
      className="private-route-content"
    >
      {children}
    </div>
  );
});

// Display name for debugging
PrivateRoute.displayName = 'PrivateRoute';

// Export the enhanced PrivateRoute component
export default PrivateRoute;