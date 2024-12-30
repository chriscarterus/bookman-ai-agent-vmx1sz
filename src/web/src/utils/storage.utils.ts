/**
 * @fileoverview Storage utility functions for browser storage operations
 * Provides type-safe, encrypted storage operations with error handling
 * @version 1.0.0
 * @package crypto-js ^4.1.1
 */

import CryptoJS from 'crypto-js';

// Global constants
const STORAGE_PREFIX = 'bookman_';
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || '';
const MAX_KEY_LENGTH = 128;
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

// Custom error types
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Type guard for storage availability
const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[type];
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Utility functions for encryption/decryption
const encryptValue = (value: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new StorageError('Encryption key not configured');
  }
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
};

const decryptValue = (encrypted: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new StorageError('Encryption key not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Validate storage key
const validateKey = (key: string): void => {
  if (!key || typeof key !== 'string') {
    throw new StorageError('Invalid storage key');
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new StorageError(`Key length exceeds maximum of ${MAX_KEY_LENGTH} characters`);
  }
};

// Check storage quota
const checkQuota = (value: string, type: 'localStorage' | 'sessionStorage'): void => {
  const valueSize = new Blob([value]).size;
  if (valueSize > MAX_STORAGE_SIZE) {
    throw new StorageError(`Value size exceeds maximum of ${MAX_STORAGE_SIZE} bytes`);
  }
};

/**
 * Safely stores an item in localStorage with optional encryption
 * @template T - Type of the value to store
 * @param {string} key - Storage key
 * @param {T} value - Value to store
 * @param {boolean} encrypt - Whether to encrypt the value
 * @throws {StorageError} If storage operation fails
 */
export const setLocalStorageItem = <T>(key: string, value: T, encrypt = false): void => {
  try {
    validateKey(key);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    if (!isStorageAvailable('localStorage')) {
      throw new StorageError('localStorage is not available');
    }

    const stringValue = JSON.stringify(value);
    checkQuota(stringValue, 'localStorage');

    const finalValue = encrypt ? encryptValue(stringValue) : stringValue;
    localStorage.setItem(prefixedKey, finalValue);

    // Emit storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: prefixedKey,
      newValue: finalValue,
    }));

  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to set localStorage item: ${error.message}`);
  }
};

/**
 * Safely retrieves and optionally decrypts an item from localStorage
 * @template T - Expected type of the stored value
 * @param {string} key - Storage key
 * @param {boolean} encrypted - Whether the value is encrypted
 * @returns {T | null} Retrieved value or null if not found
 */
export const getLocalStorageItem = <T>(key: string, encrypted = false): T | null => {
  try {
    validateKey(key);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;

    if (!isStorageAvailable('localStorage')) {
      throw new StorageError('localStorage is not available');
    }

    const value = localStorage.getItem(prefixedKey);
    if (!value) return null;

    const decryptedValue = encrypted ? decryptValue(value) : value;
    return JSON.parse(decryptedValue) as T;

  } catch (error) {
    console.error(`Failed to get localStorage item: ${error.message}`);
    return null;
  }
};

/**
 * Safely stores an item in sessionStorage with optional encryption
 * @template T - Type of the value to store
 * @param {string} key - Storage key
 * @param {T} value - Value to store
 * @param {boolean} encrypt - Whether to encrypt the value
 * @throws {StorageError} If storage operation fails
 */
export const setSessionStorageItem = <T>(key: string, value: T, encrypt = false): void => {
  try {
    validateKey(key);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;

    if (!isStorageAvailable('sessionStorage')) {
      throw new StorageError('sessionStorage is not available');
    }

    const stringValue = JSON.stringify(value);
    checkQuota(stringValue, 'sessionStorage');

    const finalValue = encrypt ? encryptValue(stringValue) : stringValue;
    sessionStorage.setItem(prefixedKey, finalValue);

  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to set sessionStorage item: ${error.message}`);
  }
};

/**
 * Safely retrieves and optionally decrypts an item from sessionStorage
 * @template T - Expected type of the stored value
 * @param {string} key - Storage key
 * @param {boolean} encrypted - Whether the value is encrypted
 * @returns {T | null} Retrieved value or null if not found
 */
export const getSessionStorageItem = <T>(key: string, encrypted = false): T | null => {
  try {
    validateKey(key);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;

    if (!isStorageAvailable('sessionStorage')) {
      throw new StorageError('sessionStorage is not available');
    }

    const value = sessionStorage.getItem(prefixedKey);
    if (!value) return null;

    const decryptedValue = encrypted ? decryptValue(value) : value;
    return JSON.parse(decryptedValue) as T;

  } catch (error) {
    console.error(`Failed to get sessionStorage item: ${error.message}`);
    return null;
  }
};

/**
 * Removes an item from both localStorage and sessionStorage
 * @param {string} key - Storage key
 */
export const removeStorageItem = (key: string): void => {
  try {
    validateKey(key);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;

    if (isStorageAvailable('localStorage')) {
      localStorage.removeItem(prefixedKey);
    }
    if (isStorageAvailable('sessionStorage')) {
      sessionStorage.removeItem(prefixedKey);
    }

    // Emit storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: prefixedKey,
      newValue: null,
    }));

  } catch (error) {
    console.error(`Failed to remove storage item: ${error.message}`);
  }
};

/**
 * Clears all storage items that start with the specified prefix
 * @param {string} prefix - Prefix to match against keys
 */
export const clearStorageWithPrefix = (prefix: string): void => {
  try {
    validateKey(prefix);
    const fullPrefix = `${STORAGE_PREFIX}${prefix}`;

    if (isStorageAvailable('localStorage')) {
      Object.keys(localStorage)
        .filter(key => key.startsWith(fullPrefix))
        .forEach(key => localStorage.removeItem(key));
    }

    if (isStorageAvailable('sessionStorage')) {
      Object.keys(sessionStorage)
        .filter(key => key.startsWith(fullPrefix))
        .forEach(key => sessionStorage.removeItem(key));
    }

    // Emit storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: fullPrefix,
      newValue: null,
    }));

  } catch (error) {
    console.error(`Failed to clear storage with prefix: ${error.message}`);
  }
};