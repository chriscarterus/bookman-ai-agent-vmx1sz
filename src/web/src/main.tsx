/**
 * Entry point for Bookman AI Platform
 * @version 1.0.0
 * @description Initializes the React application with enhanced error handling,
 * performance monitoring, and development tools
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Analytics } from '@segment/analytics-next';
import { ErrorBoundary } from '@sentry/react';

// Internal imports
import App from './App';
import './styles/global.css';

// Constants
const ROOT_ELEMENT_ID = 'root';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const SENTRY_DSN = process.env.VITE_SENTRY_DSN;
const ANALYTICS_KEY = process.env.VITE_ANALYTICS_KEY;

/**
 * Initializes error tracking and performance monitoring services
 */
const initializeMonitoring = (): void => {
  // Initialize Sentry for error tracking
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: IS_DEVELOPMENT ? 1.0 : 0.2,
      integrations: [
        new Sentry.BrowserTracing({
          tracePropagationTargets: ['localhost', 'bookman.ai']
        })
      ],
      beforeSend(event) {
        // Sanitize sensitive data
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        return event;
      }
    });
  }

  // Initialize analytics
  if (ANALYTICS_KEY) {
    const analytics = new Analytics({
      writeKey: ANALYTICS_KEY,
      plugins: [
        {
          name: 'Custom Plugin',
          type: 'enrichment',
          version: '1.0.0',
          load: () => Promise.resolve(),
          isLoaded: () => true
        }
      ]
    });

    // Make analytics globally available
    window.analytics = analytics;
  }
};

/**
 * Custom error boundary fallback component
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button 
      onClick={() => window.location.reload()}
      style={{ marginTop: '10px', padding: '8px 16px' }}
    >
      Reload Application
    </button>
  </div>
);

/**
 * Initialize and render the React application
 */
const renderApp = (): void => {
  // Initialize monitoring services
  initializeMonitoring();

  // Get root element
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Element with id '${ROOT_ELEMENT_ID}' not found`);
  }

  // Create root with concurrent features
  const root = ReactDOM.createRoot(rootElement);

  // Render application with error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={ErrorFallback}
        onError={(error) => {
          console.error('Application Error:', error);
          Sentry.captureException(error);
        }}
      >
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Development tools and logging
  if (IS_DEVELOPMENT) {
    // Enable React Developer Tools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject({
        renderers: {
          react: React
        }
      });
    }

    // Log environment information
    console.info('Development mode enabled');
    console.info('React version:', React.version);
  }
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (IS_DEVELOPMENT && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}

// Type declarations for global extensions
declare global {
  interface Window {
    analytics?: Analytics;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any;
  }
}

// Export for testing
export { renderApp, initializeMonitoring };