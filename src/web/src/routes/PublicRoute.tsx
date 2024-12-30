/**
 * Enhanced Public Route Component for Bookman AI Platform
 * @version 1.0.0
 * @description Handles public route access and redirection logic with security checks
 * and accessibility support for unauthenticated routes
 */

// External imports - versions specified for security and compatibility
import React, { memo, useEffect, useRef } from 'react'; // ^18.2.0
import { Navigate, useLocation } from 'react-router-dom'; // ^6.11.0

// Internal imports
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/route.constants';

/**
 * Props interface for PublicRoute component
 */
interface PublicRouteProps {
  /** Child components to render for public route */
  children: React.ReactNode;
  /** Optional custom redirect path for authenticated users */
  redirectPath?: string;
}

/**
 * Enhanced PublicRoute component with security and accessibility features
 * @param {PublicRouteProps} props Component props
 * @returns {JSX.Element} Rendered route or redirect component
 */
const PublicRoute: React.FC<PublicRouteProps> = memo(({ 
  children, 
  redirectPath = ROUTES.PRIVATE.DASHBOARD 
}) => {
  // Get authentication state and session status
  const { isAuthenticated, sessionStatus } = useAuth();
  const location = useLocation();
  
  // Ref for managing focus
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * Announce route changes for screen readers
   * @param {string} message Message to announce
   */
  const announceForScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('role', 'status');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Handle focus management for accessibility
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  }, [location.pathname]);

  // Validate session status
  useEffect(() => {
    if (sessionStatus === 'expired') {
      announceForScreenReader('Your session has expired. Please log in again.');
    }
  }, [sessionStatus]);

  // If user is authenticated, redirect to specified path
  if (isAuthenticated) {
    announceForScreenReader('Redirecting to dashboard');
    return (
      <Navigate 
        to={redirectPath} 
        replace 
        state={{ from: location }}
        aria-label="Redirecting to authenticated area"
      />
    );
  }

  // Render public route content with accessibility enhancements
  return (
    <div 
      ref={contentRef}
      tabIndex={-1}
      role="main"
      aria-label="Public content"
    >
      {children}
    </div>
  );
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

// Export component
export default PublicRoute;