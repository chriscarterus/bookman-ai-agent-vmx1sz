/**
 * Main routing configuration for Bookman AI Platform
 * @version 1.0.0
 * @description Implements secure route management with enhanced features including
 * code splitting, analytics tracking, and accessibility improvements
 */

import React, { useEffect, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

// Route protection components
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';

// Route constants
import { ROUTES } from '../constants/route.constants';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Lazy loaded page components
const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const Portfolio = React.lazy(() => import('../pages/Portfolio'));
const Education = React.lazy(() => import('../pages/Education'));
const Market = React.lazy(() => import('../pages/Market'));
const Security = React.lazy(() => import('../pages/Security'));
const Community = React.lazy(() => import('../pages/Community'));
const Settings = React.lazy(() => import('../pages/Settings'));
const Login = React.lazy(() => import('../pages/auth/Login'));
const Register = React.lazy(() => import('../pages/auth/Register'));
const ResetPassword = React.lazy(() => import('../pages/auth/ResetPassword'));
const VerifyEmail = React.lazy(() => import('../pages/auth/VerifyEmail'));
const ForgotPassword = React.lazy(() => import('../pages/auth/ForgotPassword'));

/**
 * Loading fallback component for lazy-loaded routes
 */
const LoadingFallback: React.FC = () => (
  <div 
    role="status" 
    aria-label="Loading page content"
    className="route-loading"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

/**
 * Enhanced routing configuration component with security and accessibility features
 */
export const AppRoutes: React.FC = () => {
  const location = useLocation();

  // Track route changes for analytics
  useEffect(() => {
    const pageView = {
      path: location.pathname,
      title: document.title,
      timestamp: new Date().toISOString()
    };

    // Dispatch analytics event
    window.dispatchEvent(new CustomEvent('analytics:pageView', {
      detail: pageView
    }));
  }, [location]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.PUBLIC.HOME} element={
          <PublicRoute>
            <AuthLayout>
              <Login />
            </AuthLayout>
          </PublicRoute>
        } />

        <Route path={ROUTES.PUBLIC.LOGIN} element={
          <PublicRoute>
            <AuthLayout>
              <Login />
            </AuthLayout>
          </PublicRoute>
        } />

        <Route path={ROUTES.PUBLIC.REGISTER} element={
          <PublicRoute>
            <AuthLayout>
              <Register />
            </AuthLayout>
          </PublicRoute>
        } />

        <Route path={ROUTES.PUBLIC.RESET_PASSWORD} element={
          <PublicRoute>
            <AuthLayout>
              <ResetPassword />
            </AuthLayout>
          </PublicRoute>
        } />

        <Route path={ROUTES.PUBLIC.VERIFY_EMAIL} element={
          <PublicRoute>
            <AuthLayout>
              <VerifyEmail />
            </AuthLayout>
          </PublicRoute>
        } />

        <Route path={ROUTES.PUBLIC.FORGOT_PASSWORD} element={
          <PublicRoute>
            <AuthLayout>
              <ForgotPassword />
            </AuthLayout>
          </PublicRoute>
        } />

        {/* Protected Routes */}
        <Route path={ROUTES.PRIVATE.DASHBOARD} element={
          <PrivateRoute>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.PORTFOLIO.ROOT}/*`} element={
          <PrivateRoute>
            <DashboardLayout>
              <Portfolio />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.EDUCATION.ROOT}/*`} element={
          <PrivateRoute>
            <DashboardLayout>
              <Education />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.MARKET.ROOT}/*`} element={
          <PrivateRoute>
            <DashboardLayout>
              <Market />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.SECURITY.ROOT}/*`} element={
          <PrivateRoute requiresMfa={true}>
            <DashboardLayout>
              <Security />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.COMMUNITY.ROOT}/*`} element={
          <PrivateRoute>
            <DashboardLayout>
              <Community />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path={`${ROUTES.PRIVATE.SETTINGS.ROOT}/*`} element={
          <PrivateRoute>
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </PrivateRoute>
        } />

        {/* Catch-all route for 404 */}
        <Route path="*" element={
          <PublicRoute>
            <AuthLayout>
              <div role="alert" aria-label="Page not found">
                <h1>404 - Page Not Found</h1>
                <p>The requested page does not exist.</p>
              </div>
            </AuthLayout>
          </PublicRoute>
        } />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;