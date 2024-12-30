/**
 * @fileoverview Main header component for the Bookman AI platform providing navigation,
 * user profile access, and notification controls following the design system specifications.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { Avatar } from '../common/Avatar';
import { useAuth } from '../../hooks/useAuth';
import styles from './Header.module.css';

/**
 * Interface for notification configuration
 */
interface NotificationConfig {
  enabled: boolean;
  maxCount: number;
  refreshInterval: number;
}

/**
 * Props interface for the Header component
 */
interface HeaderProps {
  onMenuClick: () => void;
  className?: string;
  analyticsEnabled?: boolean;
  notificationConfig?: NotificationConfig;
}

/**
 * Main header component with enhanced security and responsive features
 */
export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  className,
  analyticsEnabled = true,
  notificationConfig = { enabled: true, maxCount: 99, refreshInterval: 30000 }
}) => {
  // Authentication state
  const { user, logout } = useAuth();

  // Local state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  /**
   * Handles profile menu interactions with security measures
   */
  const handleProfileClick = useCallback(() => {
    if (!user) return;
    setIsProfileOpen(prev => !prev);
    setIsNotificationsOpen(false);

    if (analyticsEnabled) {
      // Track profile interaction
      window.dispatchEvent(new CustomEvent('analytics:track', {
        detail: { action: 'profile_click', userId: user.id }
      }));
    }
  }, [user, analyticsEnabled]);

  /**
   * Handles notification panel interactions
   */
  const handleNotificationClick = useCallback(() => {
    if (!notificationConfig.enabled) return;
    setIsNotificationsOpen(prev => !prev);
    setIsProfileOpen(false);

    if (analyticsEnabled) {
      // Track notification interaction
      window.dispatchEvent(new CustomEvent('analytics:track', {
        detail: { action: 'notification_click' }
      }));
    }
  }, [notificationConfig.enabled, analyticsEnabled]);

  /**
   * Handles secure logout process
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setIsProfileOpen(false);
      
      if (analyticsEnabled) {
        window.dispatchEvent(new CustomEvent('analytics:track', {
          detail: { action: 'logout' }
        }));
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, analyticsEnabled]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.header__profile') && !target.closest('.header__notifications')) {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header 
      className={classNames(styles.header, className)}
      role="banner"
      aria-label="Main navigation"
    >
      <div className={styles.headerContent}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <Button
            className={styles.menuButton}
            onClick={onMenuClick}
            aria-label="Toggle navigation menu"
            icon={<Icon name="menu" size="medium" />}
            variant="text"
          />
        )}

        {/* Logo Section */}
        <div className={styles.logoSection}>
          <Icon name="dashboard" size="large" />
          <span className={styles.logoText}>Bookman AI</span>
        </div>

        {/* Actions Section */}
        <div className={styles.actionsSection}>
          {/* Notifications */}
          {notificationConfig.enabled && (
            <div className={styles.notifications}>
              <Button
                className={styles.notificationButton}
                onClick={handleNotificationClick}
                aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount} unread)` : ''}`}
                aria-expanded={isNotificationsOpen}
                icon={<Icon name="notifications" size="medium" />}
                variant="text"
              />
              {notificationCount > 0 && (
                <span className={styles.notificationBadge}>
                  {notificationCount > notificationConfig.maxCount ? '99+' : notificationCount}
                </span>
              )}
            </div>
          )}

          {/* User Profile */}
          {user && (
            <div className={styles.profile}>
              <Button
                className={styles.profileButton}
                onClick={handleProfileClick}
                aria-label="User profile menu"
                aria-expanded={isProfileOpen}
                variant="text"
              >
                <Avatar
                  src={user.profileUrl}
                  name={user.username}
                  size="medium"
                  className={styles.avatar}
                />
                {!isMobile && (
                  <span className={styles.username}>{user.username}</span>
                )}
              </Button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div 
                  className={styles.profileDropdown}
                  role="menu"
                  aria-label="User menu"
                >
                  <Button
                    className={styles.profileMenuItem}
                    onClick={() => {/* Handle profile click */}}
                    variant="text"
                    fullWidth
                  >
                    <Icon name="user" size="small" />
                    Profile
                  </Button>
                  <Button
                    className={styles.profileMenuItem}
                    onClick={() => {/* Handle settings click */}}
                    variant="text"
                    fullWidth
                  >
                    <Icon name="settings" size="small" />
                    Settings
                  </Button>
                  <Button
                    className={styles.profileMenuItem}
                    onClick={handleLogout}
                    variant="text"
                    fullWidth
                  >
                    <Icon name="logout" size="small" />
                    Logout
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;