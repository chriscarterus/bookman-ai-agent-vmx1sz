import React, { useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom'; // ^6.14.0
import classnames from 'classnames'; // ^2.3.2
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { useTheme, useMediaQuery } from '@mui/material'; // ^5.13.0

// Internal imports
import { Icon } from '../common/Icon';
import { ROUTES } from '../../constants/route.constants';
import { useAuth } from '../../hooks/useAuth';
import { ComponentSize } from '../../types/common.types';

/**
 * Navigation component props interface
 */
interface NavigationProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Controls if navigation is in collapsed state */
  collapsed?: boolean;
  /** Optional callback for navigation events */
  onNavigate?: () => void;
  /** Accessibility label for navigation */
  ariaLabel?: string;
  /** Custom icon mappings */
  customIcons?: Record<string, string>;
}

/**
 * Navigation item interface
 */
interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
  tooltip?: string;
}

/**
 * Generates navigation items based on user roles and authentication state
 * @param roles - User roles for access control
 * @returns Array of filtered navigation items
 */
const getNavigationItems = (roles: string[] = []): NavItem[] => {
  const baseItems: NavItem[] = [
    {
      path: ROUTES.PRIVATE.DASHBOARD,
      label: 'navigation.dashboard',
      icon: 'dashboard',
      tooltip: 'tooltips.dashboard'
    },
    {
      path: ROUTES.PRIVATE.PORTFOLIO.ROOT,
      label: 'navigation.portfolio',
      icon: 'portfolio',
      tooltip: 'tooltips.portfolio'
    },
    {
      path: ROUTES.PRIVATE.EDUCATION.ROOT,
      label: 'navigation.education',
      icon: 'education',
      tooltip: 'tooltips.education'
    },
    {
      path: ROUTES.PRIVATE.MARKET.ROOT,
      label: 'navigation.market',
      icon: 'market',
      tooltip: 'tooltips.market'
    },
    {
      path: ROUTES.PRIVATE.SECURITY.ROOT,
      label: 'navigation.security',
      icon: 'security',
      roles: ['SECURITY', 'ADMIN'],
      tooltip: 'tooltips.security'
    },
    {
      path: ROUTES.PRIVATE.COMMUNITY.ROOT,
      label: 'navigation.community',
      icon: 'community',
      tooltip: 'tooltips.community'
    }
  ];

  // Filter items based on user roles
  return baseItems.filter(item => 
    !item.roles || item.roles.some(role => roles.includes(role))
  );
};

/**
 * Enterprise-grade navigation component with accessibility and responsive design
 */
export const Navigation: React.FC<NavigationProps> = React.memo(({
  className,
  collapsed = false,
  onNavigate,
  ariaLabel = 'Main navigation',
  customIcons = {}
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Generate navigation items based on user roles
  const navigationItems = useMemo(() => 
    getNavigationItems(user?.role ? [user.role] : []),
    [user?.role]
  );

  /**
   * Handles navigation interaction with analytics
   */
  const handleNavigation = useCallback((path: string) => {
    // Execute navigation callback if provided
    if (onNavigate) {
      onNavigate();
    }

    // Analytics tracking could be added here
    console.debug('Navigation:', path);
  }, [onNavigate]);

  /**
   * Determines if a navigation item is active
   */
  const isActiveRoute = useCallback((path: string): boolean => {
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav
      className={classnames('navigation', {
        'navigation--collapsed': collapsed,
        'navigation--mobile': isMobile,
        [className || '']: !!className
      })}
      aria-label={ariaLabel}
      role="navigation"
    >
      <ul className="navigation__list" role="menubar">
        {navigationItems.map((item) => (
          <li
            key={item.path}
            className="navigation__item"
            role="none"
          >
            <NavLink
              to={item.path}
              className={({ isActive }) => classnames('navigation__link', {
                'navigation__link--active': isActive || isActiveRoute(item.path)
              })}
              onClick={() => handleNavigation(item.path)}
              role="menuitem"
              aria-current={isActiveRoute(item.path) ? 'page' : undefined}
              title={item.tooltip ? t(item.tooltip) : undefined}
            >
              <Icon
                name={customIcons[item.icon] || item.icon}
                size={ComponentSize.MEDIUM}
                className="navigation__icon"
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="navigation__label">
                  {t(item.label)}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;