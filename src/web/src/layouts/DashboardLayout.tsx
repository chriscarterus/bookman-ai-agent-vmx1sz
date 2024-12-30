/**
 * @fileoverview Main dashboard layout component for authenticated pages in Bookman AI platform.
 * Implements responsive design, real-time portfolio data integration, and enhanced accessibility.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.14.0
import { useMediaQuery } from '@mui/material'; // ^5.14.0
import classNames from 'classnames'; // ^2.3.2

// Internal imports
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';
import styles from './DashboardLayout.module.css';

/**
 * Props interface for DashboardLayout component
 */
interface DashboardLayoutProps {
  /** Child components to render in main content area */
  children: React.ReactNode;
  /** Optional additional CSS classes */
  className?: string;
  /** Toggle for portfolio data display */
  showPortfolioData?: boolean;
}

/**
 * Enhanced dashboard layout component with performance optimizations
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = React.memo(({
  children,
  className,
  showPortfolioData = true
}) => {
  // Hooks
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Local state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored ? JSON.parse(stored) : isMobile;
  });

  /**
   * Handles sidebar toggle with state persistence
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
      return newState;
    });
  }, []);

  /**
   * Handles mobile menu button clicks
   */
  const handleMenuClick = useCallback(() => {
    if (isMobile) {
      setIsSidebarCollapsed(false);
    }
  }, [isMobile]);

  // Authentication check effect
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Mobile responsive effect
  useEffect(() => {
    const handleResize = () => {
      if (isMobile && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, isSidebarCollapsed]);

  // Early return if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div 
      className={classNames(
        styles.dashboardLayout,
        {
          [styles.collapsed]: isSidebarCollapsed,
          [styles.mobile]: isMobile
        },
        className
      )}
      role="main"
    >
      <Header 
        onMenuClick={handleMenuClick}
        className={styles.header}
        analyticsEnabled={true}
        notificationConfig={{
          enabled: true,
          maxCount: 99,
          refreshInterval: 30000
        }}
      />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
        className={styles.sidebar}
      />

      <main 
        className={styles.content}
        role="main"
        aria-label="Main content"
      >
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

// CSS Module definition (DashboardLayout.module.css)
/**
 * .dashboardLayout {
 *   display: grid;
 *   grid-template-areas:
 *     "header header"
 *     "sidebar content";
 *   grid-template-columns: auto 1fr;
 *   grid-template-rows: auto 1fr;
 *   min-height: 100vh;
 *   background-color: var(--background-default);
 * }
 *
 * .header {
 *   grid-area: header;
 *   position: sticky;
 *   top: 0;
 *   z-index: var(--z-index-header);
 * }
 *
 * .sidebar {
 *   grid-area: sidebar;
 *   transition: width var(--transition-duration) var(--transition-timing);
 * }
 *
 * .content {
 *   grid-area: content;
 *   padding: var(--spacing-md);
 *   overflow-y: auto;
 * }
 *
 * .contentWrapper {
 *   max-width: 1440px;
 *   margin: 0 auto;
 *   width: 100%;
 * }
 *
 * .collapsed .sidebar {
 *   width: var(--sidebar-collapsed-width);
 * }
 *
 * .mobile {
 *   grid-template-columns: 1fr;
 *   grid-template-areas:
 *     "header"
 *     "content";
 * }
 *
 * .mobile .sidebar {
 *   position: fixed;
 *   left: 0;
 *   top: var(--header-height);
 *   height: calc(100vh - var(--header-height));
 *   transform: translateX(-100%);
 *   transition: transform var(--transition-duration) var(--transition-timing);
 * }
 *
 * .mobile:not(.collapsed) .sidebar {
 *   transform: translateX(0);
 * }
 */

export default DashboardLayout;