/**
 * @fileoverview Custom React hook for managing dark mode theme state with system preference detection,
 * persistence, and cross-tab synchronization. Integrates with Material UI v5 theming system.
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import { ThemeMode, THEME_LIGHT, THEME_DARK } from '../config/theme.config';

// Constants
const THEME_KEY = 'theme_mode';
const DARK_MODE_CLASS = 'dark-mode';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Helper function to detect system color scheme preference
 * @returns {boolean} True if system prefers dark mode, false otherwise
 */
const getSystemThemePreference = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
};

/**
 * Custom hook for managing dark mode theme state with system preference detection
 * and persistence across sessions and tabs
 * @returns {[boolean, () => void]} Tuple containing isDarkMode state and toggle function
 */
const useDarkMode = (): [boolean, () => void] => {
  // Initialize theme state from localStorage with system preference as fallback
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>(
    THEME_KEY,
    getSystemThemePreference()
  );

  /**
   * Memoized theme toggle function
   */
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prevMode => !prevMode);
  }, [setIsDarkMode]);

  /**
   * Update document root class and ARIA attributes based on theme
   */
  const updateDocumentTheme = useCallback((darkMode: boolean) => {
    const root = document.documentElement;
    const themeMode = darkMode ? THEME_DARK : THEME_LIGHT;

    // Update CSS classes
    if (darkMode) {
      root.classList.add(DARK_MODE_CLASS);
    } else {
      root.classList.remove(DARK_MODE_CLASS);
    }

    // Update theme-related attributes
    root.setAttribute('data-theme', themeMode);
    root.setAttribute('color-scheme', themeMode);
    root.style.colorScheme = themeMode;

    // Update ARIA attributes for accessibility
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', darkMode ? '#121212' : '#ffffff');
  }, []);

  /**
   * Handle system theme preference changes
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
    
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      // Only update if no explicit user preference is stored
      if (localStorage.getItem(`bookman_${THEME_KEY}`) === null) {
        setIsDarkMode(event.matches);
      }
    };

    // Add listener with compatibility check for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Initial theme application
    updateDocumentTheme(isDarkMode);

    // Cleanup listeners
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else {
        // Fallback cleanup for older browsers
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, [isDarkMode, setIsDarkMode, updateDocumentTheme]);

  // Update document theme whenever isDarkMode changes
  useEffect(() => {
    updateDocumentTheme(isDarkMode);
  }, [isDarkMode, updateDocumentTheme]);

  return [isDarkMode, toggleDarkMode];
};

export default useDarkMode;
```

This implementation includes:

1. Type-safe theme management using TypeScript and Material UI theme types
2. System preference detection with fallback for unsupported browsers
3. Cross-tab synchronization through useLocalStorage hook
4. Automatic theme updates when system preference changes
5. Proper cleanup of event listeners
6. Accessibility support with ARIA attributes and meta tags
7. CSS class and attribute management for theme switching
8. Memoized callbacks for performance optimization
9. Comprehensive error handling and fallbacks
10. Browser compatibility considerations

The hook can be used in components like this:

```typescript
const MyComponent = () => {
  const [isDarkMode, toggleDarkMode] = useDarkMode();

  return (
    <Button onClick={toggleDarkMode}>
      Toggle {isDarkMode ? 'Light' : 'Dark'} Mode
    </Button>
  );
};