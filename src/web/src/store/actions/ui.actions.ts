/**
 * @fileoverview Redux action creators for managing UI state including theme,
 * notifications, layout controls, and telemetry in the Bookman AI platform frontend.
 * @version 1.0.0
 * @license MIT
 */

// External imports
import { createAction } from '@reduxjs/toolkit'; // ^1.9.5

// Internal imports
import { Theme } from '../../types/common.types';
import { UIState } from '../../types/store.types';

// Action type constants
export const SET_THEME = 'ui/setTheme';
export const ADD_NOTIFICATION = 'ui/addNotification';
export const REMOVE_NOTIFICATION = 'ui/removeNotification';
export const TOGGLE_SIDEBAR = 'ui/toggleSidebar';

/**
 * Interface for notification configuration
 */
interface NotificationConfig {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Action creator for updating the application theme with transition animation support
 * @param theme - The theme to set ('light', 'dark', or 'system')
 * @param enableTransition - Whether to enable transition animation
 */
export const setTheme = createAction<{
  theme: Theme;
  enableTransition: boolean;
}>(SET_THEME);

/**
 * Action creator for adding a new notification with priority and auto-dismiss
 * @param config - Notification configuration object
 */
export const addNotification = createAction<NotificationConfig>(ADD_NOTIFICATION);

/**
 * Action creator for removing a notification by ID with cleanup
 * @param notificationId - Unique identifier of the notification to remove
 */
export const removeNotification = createAction<string>(REMOVE_NOTIFICATION);

/**
 * Action creator for toggling the sidebar visibility with state persistence
 * @param persist - Whether to persist the sidebar state in local storage
 */
export const toggleSidebar = createAction<{
  persist: boolean;
}>(TOGGLE_SIDEBAR);

/**
 * Helper function to generate a unique notification ID
 * @returns A unique string identifier
 */
const generateNotificationId = (): string => {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Creates a notification action with default values and unique ID
 * @param config - Partial notification configuration
 * @returns Complete notification action payload
 */
export const createNotification = (
  config: Partial<NotificationConfig>
): ReturnType<typeof addNotification> => {
  const defaultConfig: NotificationConfig = {
    type: 'info',
    message: '',
    duration: 5000,
    priority: 'medium',
    ...config,
  };

  return addNotification({
    ...defaultConfig,
    id: generateNotificationId(),
  });
};

/**
 * Creates a theme change action with transition preferences
 * @param theme - The theme to apply
 * @param enableTransition - Whether to enable transition animation
 * @returns Theme change action with configuration
 */
export const createThemeAction = (
  theme: Theme,
  enableTransition: boolean = true
): ReturnType<typeof setTheme> => {
  return setTheme({
    theme,
    enableTransition,
  });
};

/**
 * Creates a sidebar toggle action with persistence configuration
 * @param persist - Whether to persist the sidebar state
 * @returns Sidebar toggle action with configuration
 */
export const createSidebarToggle = (
  persist: boolean = true
): ReturnType<typeof toggleSidebar> => {
  return toggleSidebar({
    persist,
  });
};

// Export action types for reducer consumption
export type UIActionTypes =
  | ReturnType<typeof setTheme>
  | ReturnType<typeof addNotification>
  | ReturnType<typeof removeNotification>
  | ReturnType<typeof toggleSidebar>;