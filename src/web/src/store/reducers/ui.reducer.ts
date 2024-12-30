/**
 * @fileoverview Redux reducer for managing UI state including theme, notifications,
 * layout controls, and analytics in the Bookman AI platform frontend.
 * @version 1.0.0
 * @license MIT
 */

// External imports - v1.9.5
import { createReducer, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { UIState } from '../../types/store.types';
import { Theme } from '../../types/common.types';
import { 
  setTheme, 
  addNotification, 
  removeNotification, 
  toggleSidebar 
} from '../actions/ui.actions';

// Constants
const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_TIMEOUT = 5000;
const THEME_STORAGE_KEY = 'bookman_theme';
const SIDEBAR_STORAGE_KEY = 'bookman_sidebar';

/**
 * Interface for UI analytics tracking
 */
interface UIAnalytics {
  themeChanges: number;
  sidebarToggles: number;
  notificationCount: number;
  lastThemeChange: string | null;
  lastSidebarToggle: string | null;
}

/**
 * Initial state with system theme preference and analytics
 */
const initialState: UIState & { analytics: UIAnalytics } = {
  theme: (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'system',
  sidebarOpen: localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
  notifications: [],
  analytics: {
    themeChanges: 0,
    sidebarToggles: 0,
    notificationCount: 0,
    lastThemeChange: null,
    lastSidebarToggle: null
  }
};

/**
 * Helper function to detect system theme preference
 */
const getSystemTheme = (): Theme => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Enhanced UI reducer with analytics and persistence
 */
export const uiReducer = createReducer(initialState, (builder) => {
  builder
    // Theme management with system preference detection and persistence
    .addCase(setTheme, (state, action: PayloadAction<{ theme: Theme; enableTransition: boolean }>) => {
      const { theme, enableTransition } = action.payload;
      const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
      
      // Apply theme with transition if enabled
      if (enableTransition) {
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
        }, 300);
      }
      
      // Update theme and persist
      state.theme = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      
      // Update analytics
      state.analytics.themeChanges++;
      state.analytics.lastThemeChange = new Date().toISOString();
      
      // Apply theme class to root element
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    })
    
    // Sidebar management with persistence and analytics
    .addCase(toggleSidebar, (state, action: PayloadAction<{ persist: boolean }>) => {
      state.sidebarOpen = !state.sidebarOpen;
      
      // Persist sidebar state if requested
      if (action.payload.persist) {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, state.sidebarOpen.toString());
      }
      
      // Update analytics
      state.analytics.sidebarToggles++;
      state.analytics.lastSidebarToggle = new Date().toISOString();
    })
    
    // Notification management with priority queue and auto-dismiss
    .addCase(addNotification, (state, action: PayloadAction<{
      type: 'info' | 'success' | 'warning' | 'error';
      message: string;
      duration?: number;
      actionUrl?: string;
      priority?: 'low' | 'medium' | 'high';
    }>) => {
      // Enforce notification limit with priority-based removal
      if (state.notifications.length >= MAX_NOTIFICATIONS) {
        const lowestPriorityIndex = state.notifications.findIndex(n => 
          n.priority === 'low' || !n.priority
        );
        if (lowestPriorityIndex !== -1) {
          state.notifications.splice(lowestPriorityIndex, 1);
        } else {
          state.notifications.shift(); // Remove oldest if no low priority
        }
      }
      
      // Add new notification with metadata
      const notification = {
        id: `notification_${Date.now()}`,
        timestamp: Date.now(),
        read: false,
        ...action.payload
      };
      
      state.notifications.push(notification);
      
      // Update analytics
      state.analytics.notificationCount++;
      
      // Setup auto-dismiss for non-error notifications
      if (action.payload.type !== 'error') {
        setTimeout(() => {
          const index = state.notifications.findIndex(n => n.id === notification.id);
          if (index !== -1) {
            state.notifications.splice(index, 1);
          }
        }, action.payload.duration || NOTIFICATION_TIMEOUT);
      }
    })
    
    // Notification removal with cleanup
    .addCase(removeNotification, (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        state.notifications.splice(index, 1);
      }
    })
    
    // Analytics reset action
    .addCase('ui/resetAnalytics', (state) => {
      state.analytics = {
        themeChanges: 0,
        sidebarToggles: 0,
        notificationCount: 0,
        lastThemeChange: null,
        lastSidebarToggle: null
      };
    });
});

export default uiReducer;