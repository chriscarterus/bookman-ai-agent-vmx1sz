/**
 * Root Application Component for Bookman AI Platform
 * @version 1.0.0
 * @description Implements the core application structure with enhanced security,
 * performance monitoring, and accessibility features
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux'; // ^8.0.5
import { BrowserRouter } from 'react-router-dom'; // ^6.11.0
import { ThemeProvider, CssBaseline } from '@mui/material'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import { store } from './store';
import AppRoutes from './routes';
import { useAuth } from './hooks/useAuth';
import { theme } from './theme';

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={() => window.location.reload()}>
        Reload Application
      </button>
    </div>
  );
};

/**
 * Performance monitoring wrapper component
 */
const PerformanceMonitor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Initialize performance monitoring
    const reportWebVitals = ({ id, name, value }: any) => {
      window.dispatchEvent(new CustomEvent('analytics:performance', {
        detail: { metric: name, value, id }
      }));
    };

    // Report initial page load metrics
    if ('performance' in window) {
      window.performance.mark('app_start');
      const navigationEntry = performance.getEntriesByType('navigation')[0];
      reportWebVitals({
        id: 'initial_load',
        name: 'page_load',
        value: navigationEntry.duration
      });
    }

    return () => {
      performance.clearMarks();
    };
  }, []);

  return <>{children}</>;
};

/**
 * Session monitor component for handling authentication state
 */
const SessionMonitor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { refreshSession } = useAuth();

  useEffect(() => {
    // Check session status every minute
    const interval = setInterval(() => {
      refreshSession().catch(console.error);
    }, 60000);

    return () => clearInterval(interval);
  }, [refreshSession]);

  return <>{children}</>;
};

/**
 * Root application component that provides core configurations and enhanced features
 */
const App: React.FC = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Application Error:', error);
          // Report error to monitoring service
          window.dispatchEvent(new CustomEvent('analytics:error', {
            detail: { error }
          }));
        }}
      >
        <Provider store={store}>
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <PerformanceMonitor>
                <SessionMonitor>
                  <div 
                    className="app-container"
                    role="application"
                    aria-label="Bookman AI Platform"
                  >
                    <AppRoutes />
                  </div>
                </SessionMonitor>
              </PerformanceMonitor>
            </ThemeProvider>
          </BrowserRouter>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Enable hot module replacement for development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
}

export default App;