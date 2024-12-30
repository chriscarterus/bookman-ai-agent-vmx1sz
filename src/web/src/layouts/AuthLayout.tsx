import React from 'react';
import classNames from 'classnames';

// Internal imports
import { Alert } from '../components/common/Alert';
import { Loading } from '../components/common/Loading';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../hooks/useAuth';

// Styles
import styles from './AuthLayout.module.css';

/**
 * Props interface for AuthLayout component
 */
interface AuthLayoutProps {
  /** Child components to render within layout */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
}

/**
 * Authentication layout component that provides consistent structure for auth pages
 * Implements WCAG 2.1 AA compliance and Material UI v5 design system integration
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  className,
  role = 'main'
}) => {
  // Get authentication state and error handling from useAuth hook
  const { loading, error, clearError } = useAuth();

  return (
    <div 
      className={classNames(styles['auth-layout'], className)}
      role={role}
      aria-live="polite"
    >
      {/* Loading Overlay */}
      {loading && (
        <div className={styles['auth-layout__loading']}>
          <Loading 
            size="large"
            color="primary"
            overlay
            aria-label="Authentication in progress"
          />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className={styles['auth-layout__alert']}>
          <Alert
            severity="error"
            message={error.message}
            onClose={clearError}
            aria-live="assertive"
          />
        </div>
      )}

      {/* Main Content Container */}
      <div className={styles['auth-layout__content']}>
        {/* Logo Section */}
        <div className={styles['auth-layout__logo']}>
          <img 
            src="/assets/images/logo.svg" 
            alt="Bookman AI"
            width={180}
            height={48}
          />
        </div>

        {/* Auth Form Content */}
        <div className={styles['auth-layout__form']}>
          {children}
        </div>
      </div>

      {/* Footer */}
      <Footer className={styles['auth-layout__footer']} />
    </div>
  );
};

// CSS Module styles
const styles = {
  'auth-layout': `
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-background);
    position: relative;
  `,
  'auth-layout__loading': `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-index-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.8);
  `,
  'auth-layout__alert': `
    position: fixed;
    top: var(--spacing-4);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-index-toast);
    width: 100%;
    max-width: 480px;
    padding: 0 var(--spacing-4);
  `,
  'auth-layout__content': `
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-6) var(--spacing-4);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  `,
  'auth-layout__logo': `
    margin-bottom: var(--spacing-8);
    text-align: center;
  `,
  'auth-layout__form': `
    width: 100%;
    background-color: var(--color-white);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    padding: var(--spacing-6);
  `,
  'auth-layout__footer': `
    margin-top: auto;
  `
} as const;

export default AuthLayout;