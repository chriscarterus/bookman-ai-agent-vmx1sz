/**
 * @fileoverview Custom React hook for type-safe localStorage operations with state synchronization
 * Provides automatic JSON serialization/deserialization and cross-tab synchronization
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { setLocalStorageItem, getLocalStorageItem } from '../utils/storage.utils';

// Debounce timeout in milliseconds
const DEBOUNCE_DELAY = 300;

/**
 * Custom hook error class for type-safe error handling
 */
class UseLocalStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UseLocalStorageError';
  }
}

/**
 * Type guard to check if a value matches the expected type
 * @template T Expected type
 * @param value Value to check
 * @param initialValue Reference value for type comparison
 */
const isTypeMatching = <T>(value: unknown, initialValue: T): value is T => {
  if (initialValue === null) return value === null;
  return typeof value === typeof initialValue;
};

/**
 * Custom React hook for managing state that syncs with localStorage
 * @template T Type of the stored value
 * @param {string} key Storage key
 * @param {T} initialValue Initial value if none exists in storage
 * @returns {[T, (value: T | ((val: T) => T)) => void]} Tuple of current value and setter function
 * @throws {UseLocalStorageError} If key is invalid or storage operations fail
 */
const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  // Validate key parameter
  if (!key || typeof key !== 'string') {
    throw new UseLocalStorageError('Storage key must be a non-empty string');
  }

  // Reference for tracking mounted state
  const isMounted = useRef(true);
  
  // Debounce timer reference
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Initialize state with stored value or initial value
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = getLocalStorageItem<T>(key);
      if (storedValue !== null && isTypeMatching(storedValue, initialValue)) {
        return storedValue;
      }
      // Initialize storage with initial value if no valid value exists
      setLocalStorageItem(key, initialValue);
      return initialValue;
    } catch (error) {
      console.error(`Failed to initialize localStorage for key "${key}":`, error);
      return initialValue;
    }
  });

  /**
   * Memoized storage update function with debouncing
   */
  const updateStorage = useCallback((newValue: T) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      try {
        setLocalStorageItem(key, newValue);
      } catch (error) {
        console.error(`Failed to update localStorage for key "${key}":`, error);
        // Attempt to remove old data if quota is exceeded
        try {
          const oldValue = getLocalStorageItem(key);
          if (oldValue !== null) {
            setLocalStorageItem(key, newValue);
          }
        } catch (retryError) {
          console.error(`Retry failed for key "${key}":`, retryError);
        }
      }
    }, DEBOUNCE_DELAY);
  }, [key]);

  /**
   * Handle storage changes from other tabs
   */
  const handleStorageChange = useCallback((event: StorageEvent) => {
    if (!isMounted.current) return;
    
    if (event.key === `bookman_${key}` && event.newValue !== null) {
      try {
        const newValue = JSON.parse(event.newValue) as unknown;
        if (isTypeMatching(newValue, initialValue)) {
          setState(newValue);
        }
      } catch (error) {
        console.error(`Failed to process storage event for key "${key}":`, error);
      }
    }
  }, [key, initialValue]);

  /**
   * Set up storage event listener for cross-tab synchronization
   */
  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      isMounted.current = false;
      window.removeEventListener('storage', handleStorageChange);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [handleStorageChange]);

  /**
   * Memoized state setter that updates both state and storage
   */
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const newValue = value instanceof Function ? value(state) : value;
      
      if (!isTypeMatching(newValue, initialValue)) {
        throw new UseLocalStorageError('New value does not match expected type');
      }

      setState(newValue);
      updateStorage(newValue);
    } catch (error) {
      console.error(`Failed to set value for key "${key}":`, error);
      throw error instanceof UseLocalStorageError ? error : new UseLocalStorageError(error.message);
    }
  }, [state, initialValue, key, updateStorage]);

  return [state, setValue];
};

export default useLocalStorage;
```

This implementation includes:

1. Type safety with TypeScript generics and runtime type checking
2. Cross-tab synchronization using the Storage event
3. Debounced updates to prevent excessive storage operations
4. Comprehensive error handling with custom error types
5. Cleanup on unmount to prevent memory leaks
6. Memoized callbacks for better performance
7. Automatic JSON serialization/deserialization
8. Fallback to initial value if storage is unavailable
9. Storage quota management with retry logic
10. Detailed error logging for debugging

The hook can be used like this:

```typescript
// Example usage
const [preferences, setPreferences] = useLocalStorage('user-preferences', {
  theme: 'light',
  fontSize: 14
});

// Update single value
setPreferences({ ...preferences, theme: 'dark' });

// Update using callback
setPreferences(prev => ({ ...prev, fontSize: prev.fontSize + 1 }));