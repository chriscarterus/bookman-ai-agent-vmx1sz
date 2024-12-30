/**
 * @fileoverview Enterprise-grade main layout component that provides the core application structure
 * with responsive behavior, accessibility support, and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { useLocalStorage } from '@rehooks/local-storage';

// Internal imports
import { Header } from '../components/layout/Header';
import { Navigation } from '../components/layout/Navigation';
import { BaseComponentProps } from '../types/common.types';
import styles from './MainLayout.module.css';

/**
 * Props interface for the MainLayout component
 */
interface MainLayoutProps extends BaseComponentProps {
  /** Child components to render in content area */
  children: React.ReactNode;
  /** Initial sidebar open state */
  initialSidebarState?: boolean;
}

/**
 * Custom hook for managing layout state with persistence
 */
const useLayoutState = (key: string, initialValue: any) => {
  const [storedValue, setStoredValue] = useLocalStorage(key, initialValue);

  const setValue = useCallback((value: any) => {
    try {
      // Allow value to be a function for state updates
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
    } catch (error) {
      console.error('Error saving layout state:', error);
    }
  }, [storedValue, setStoredValue]);

  return [storedValue, setValue];
};

/**
 * Custom hook for responsive layout management
 */
const useResponsiveLayout = () => {
  const theme = {
    breakpoints: {
      values: {
        mobile: 320,
        tablet: 768,
        desktop: 1024,
        largeDesktop: 1440
      }
    }
  };

  const isMobile = useMediaQuery(`(max-width:${theme.breakpoints.values.tablet - 1}px)`);
  const isTablet = useMediaQuery(
    `(min-width:${theme.breakpoints.values.tablet}px) and (max-width:${theme.breakpoints.values.desktop - 1}px)`
  );
  const isDesktop = useMediaQuery(`(min-width:${theme.breakpoints.values.desktop}px)`);

  return useMemo(() => ({
    isMobile,
    isTablet,
    isDesktop,
    currentBreakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
  }), [isMobile, isTablet, isDesktop]);
};

/**
 * Enhanced main layout component with enterprise features
 */
export const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  className,
  initialSidebarState = true,
  ...rest
}) => {
  // Layout state management
  const [isSidebarOpen, setIsSidebarOpen] = useLayoutState('layout_sidebar_state', initialSidebarState);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Responsive layout management
  const { isMobile, currentBreakpoint } = useResponsiveLayout();

  /**
   * Handles sidebar toggle with smooth transitions
   */
  const handleSidebarToggle = useCallback(() => {
    setIsTransitioning(true);
    setIsSidebarOpen(prev => !prev);
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [setIsSidebarOpen]);

  /**
   * Handles mobile menu toggle
   */
  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  /**
   * Handles navigation state changes
   */
  const handleNavigationStateChange = useCallback(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, isMobileMenuOpen]);

  // Handle escape key for accessibility
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isMobileMenuOpen]);

  return (
    <div
      className={`${styles.layout} ${className || ''}`}
      data-breakpoint={currentBreakpoint}
      data-sidebar-state={isSidebarOpen ? 'open' : 'closed'}
      {...rest}
    >
      <Header
        onMenuClick={isMobile ? handleMobileMenuToggle : handleSidebarToggle}
        className={styles.header}
      />

      <div className={styles.container}>
        <Navigation
          className={styles.navigation}
          collapsed={!isSidebarOpen && !isMobile}
          onNavigate={handleNavigationStateChange}
          ariaLabel="Main navigation"
        />

        <main
          className={`${styles.content} ${isTransitioning ? styles.transitioning : ''}`}
          id="main-content"
          role="main"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      {/* Mobile navigation overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className={styles.overlay}
          onClick={handleMobileMenuToggle}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className={styles.skipLink}
        tabIndex={0}
      >
        Skip to main content
      </a>
    </div>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;