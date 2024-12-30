/**
 * @fileoverview User preferences settings page component with theme, notifications,
 * language, and chart display settings. Implements comprehensive security and
 * accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash'; // ^4.17.21

// Internal imports
import useDarkMode from '../../hooks/useDarkMode';
import useLocalStorage from '../../hooks/useLocalStorage';
import Select from '../../components/common/Select';
import { sanitizeInput } from '../../utils/validation.utils';
import { ComponentSize } from '../../types/common.types';

// Constants
const PREFERENCES_KEYS = {
  THEME: 'theme',
  LANGUAGE: 'language',
  NOTIFICATIONS: 'notifications',
  CHART_INTERVAL: 'chart_interval'
} as const;

// Language options
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' }
];

// Chart interval options
const CHART_INTERVAL_OPTIONS = [
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' }
];

// Notification types
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  marketAlerts: boolean;
}

// User preferences interface
interface UserPreferences {
  theme: string;
  language: string;
  notifications: NotificationPreferences;
  chartInterval: string;
}

/**
 * User preferences settings page component
 */
const Preferences: React.FC = () => {
  // Theme management
  const [isDarkMode, toggleDarkMode] = useDarkMode();

  // Preferences state management with secure storage
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>('user_preferences', {
    theme: isDarkMode ? 'dark' : 'light',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      marketAlerts: true
    },
    chartInterval: '1d'
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handles theme toggle with system preference detection
   */
  const handleThemeToggle = useCallback(debounce(() => {
    toggleDarkMode();
    setPreferences(prev => ({
      ...prev,
      theme: !isDarkMode ? 'dark' : 'light'
    }));

    // Announce theme change to screen readers
    const message = `Theme changed to ${!isDarkMode ? 'dark' : 'light'} mode`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, 300), [isDarkMode, toggleDarkMode, setPreferences]);

  /**
   * Handles language change with validation
   */
  const handleLanguageChange = useCallback(debounce((language: string) => {
    const sanitizedLanguage = sanitizeInput(language);
    if (LANGUAGE_OPTIONS.some(option => option.value === sanitizedLanguage)) {
      setPreferences(prev => ({
        ...prev,
        language: sanitizedLanguage
      }));

      // Update document language
      document.documentElement.lang = sanitizedLanguage;

      // Announce language change
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Language changed to ${
        LANGUAGE_OPTIONS.find(opt => opt.value === sanitizedLanguage)?.label
      }`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, 300), [setPreferences]);

  /**
   * Handles notification preference changes
   */
  const handleNotificationToggle = useCallback(debounce((type: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  }, 300), [setPreferences]);

  /**
   * Handles chart interval changes with validation
   */
  const handleChartIntervalChange = useCallback(debounce((interval: string) => {
    const sanitizedInterval = sanitizeInput(interval);
    if (CHART_INTERVAL_OPTIONS.some(option => option.value === sanitizedInterval)) {
      setPreferences(prev => ({
        ...prev,
        chartInterval: sanitizedInterval
      }));
    }
  }, 300), [setPreferences]);

  // Sync preferences with system on mount
  useEffect(() => {
    const syncPreferences = async () => {
      setIsLoading(true);
      try {
        // Sync system theme preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
          if (preferences.theme === 'system') {
            toggleDarkMode();
          }
        };
        mediaQuery.addEventListener('change', handleSystemThemeChange);

        // Sync system language preference
        const systemLanguage = navigator.language.split('-')[0];
        if (!preferences.language && LANGUAGE_OPTIONS.some(opt => opt.value === systemLanguage)) {
          handleLanguageChange(systemLanguage);
        }

        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } catch (error) {
        console.error('Failed to sync preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    syncPreferences();
  }, [preferences.theme, preferences.language, toggleDarkMode, handleLanguageChange]);

  return (
    <div className="preferences-page" role="main" aria-label="Preferences Settings">
      <h1 className="preferences-title">User Preferences</h1>

      {/* Theme Settings */}
      <section className="preferences-section" aria-labelledby="theme-title">
        <h2 id="theme-title">Theme Settings</h2>
        <div className="preference-item">
          <label className="switch-label" htmlFor="theme-toggle">
            Dark Mode
          </label>
          <button
            id="theme-toggle"
            className={`theme-toggle ${isDarkMode ? 'dark' : 'light'}`}
            onClick={handleThemeToggle}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? 'Dark Mode On' : 'Dark Mode Off'}
          </button>
        </div>
      </section>

      {/* Language Settings */}
      <section className="preferences-section" aria-labelledby="language-title">
        <h2 id="language-title">Language Settings</h2>
        <Select
          options={LANGUAGE_OPTIONS}
          value={preferences.language}
          onChange={handleLanguageChange}
          size={ComponentSize.MEDIUM}
          ariaLabel="Select language"
          id="language-select"
        />
      </section>

      {/* Notification Settings */}
      <section className="preferences-section" aria-labelledby="notifications-title">
        <h2 id="notifications-title">Notification Settings</h2>
        {Object.entries(preferences.notifications).map(([type, enabled]) => (
          <div key={type} className="preference-item">
            <label className="switch-label" htmlFor={`notification-${type}`}>
              {type.charAt(0).toUpperCase() + type.slice(1)} Notifications
            </label>
            <button
              id={`notification-${type}`}
              className={`notification-toggle ${enabled ? 'enabled' : 'disabled'}`}
              onClick={() => handleNotificationToggle(type as keyof NotificationPreferences)}
              aria-pressed={enabled}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </section>

      {/* Chart Settings */}
      <section className="preferences-section" aria-labelledby="chart-title">
        <h2 id="chart-title">Chart Settings</h2>
        <Select
          options={CHART_INTERVAL_OPTIONS}
          value={preferences.chartInterval}
          onChange={handleChartIntervalChange}
          size={ComponentSize.MEDIUM}
          ariaLabel="Select default chart interval"
          id="chart-interval-select"
        />
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className="loading-overlay" role="alert" aria-busy="true">
          Loading preferences...
        </div>
      )}
    </div>
  );
};

export default Preferences;