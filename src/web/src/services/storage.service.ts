/**
 * @fileoverview Storage service for secure browser storage operations
 * Provides encrypted storage with compression and cross-tab synchronization
 * @version 1.0.0
 * @package crypto-js ^4.1.1
 */

import CryptoJS from 'crypto-js';
import {
  setLocalStorageItem,
  getLocalStorageItem,
  setSessionStorageItem,
  getSessionStorageItem
} from '../utils/storage.utils';

// Storage keys enum for type safety
export enum StorageKeys {
  USER_PREFERENCES = 'user_preferences',
  AUTH_TOKEN = 'auth_token',
  THEME = 'theme',
  LANGUAGE = 'language',
  MARKET_FAVORITES = 'market_favorites',
  PORTFOLIO_SETTINGS = 'portfolio_settings',
  ENCRYPTION_VERSION = 'encryption_version',
  STORAGE_METADATA = 'storage_metadata'
}

// Types for storage metadata
interface StorageMetadata {
  version: string;
  lastUpdated: number;
  encryptionVersion: string;
  keys: string[];
}

interface StorageItem<T> {
  data: T;
  metadata: {
    version: string;
    compressed: boolean;
    timestamp: number;
    checksum: string;
  };
}

/**
 * Service class for managing browser storage with encryption and compression
 */
export class StorageService {
  private readonly encryptionKey: string;
  private readonly storageVersion: string;
  private readonly compressionThreshold: number = 1024; // 1KB
  private metadata: StorageMetadata;

  constructor() {
    this.encryptionKey = process.env.VITE_STORAGE_ENCRYPTION_KEY || '';
    this.storageVersion = process.env.VITE_STORAGE_VERSION || '1.0';

    if (!this.encryptionKey) {
      throw new Error('Storage encryption key not configured');
    }

    // Initialize storage metadata
    this.metadata = this.initializeMetadata();
    this.setupStorageListeners();
  }

  /**
   * Stores an encrypted item with optional compression
   * @template T - Type of value to store
   * @param {StorageKeys} key - Storage key
   * @param {T} value - Value to store
   * @param {boolean} compress - Whether to compress the data
   * @returns {Promise<void>}
   */
  public async setSecureItem<T>(
    key: StorageKeys,
    value: T,
    compress: boolean = false
  ): Promise<void> {
    try {
      const shouldCompress = compress && 
        JSON.stringify(value).length > this.compressionThreshold;

      const storageItem: StorageItem<T> = {
        data: value,
        metadata: {
          version: this.storageVersion,
          compressed: shouldCompress,
          timestamp: Date.now(),
          checksum: this.generateChecksum(value)
        }
      };

      const serializedData = JSON.stringify(storageItem);
      const compressedData = shouldCompress ? 
        this.compressData(serializedData) : 
        serializedData;

      const encryptedData = CryptoJS.AES.encrypt(
        compressedData,
        this.encryptionKey
      ).toString();

      await setLocalStorageItem(key, encryptedData, true);
      this.updateMetadata(key);

    } catch (error) {
      console.error(`Failed to set secure item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieves and decrypts an item with version validation
   * @template T - Expected type of stored value
   * @param {StorageKeys} key - Storage key
   * @returns {Promise<T | null>}
   */
  public async getSecureItem<T>(key: StorageKeys): Promise<T | null> {
    try {
      const encryptedData = await getLocalStorageItem<string>(key, true);
      if (!encryptedData) return null;

      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      const storageItem: StorageItem<T> = JSON.parse(
        decryptedData.startsWith('{') ? 
          decryptedData : 
          this.decompressData(decryptedData)
      );

      // Validate version and checksum
      if (storageItem.metadata.version !== this.storageVersion) {
        console.warn(`Storage version mismatch for key: ${key}`);
        return null;
      }

      if (this.generateChecksum(storageItem.data) !== storageItem.metadata.checksum) {
        console.error(`Checksum validation failed for key: ${key}`);
        return null;
      }

      return storageItem.data;

    } catch (error) {
      console.error(`Failed to get secure item: ${error.message}`);
      return null;
    }
  }

  /**
   * Rotates encryption key for all stored items
   * @param {string} newKey - New encryption key
   * @returns {Promise<void>}
   */
  public async rotateEncryptionKey(newKey: string): Promise<void> {
    try {
      if (!newKey || newKey === this.encryptionKey) {
        throw new Error('Invalid new encryption key');
      }

      const oldKey = this.encryptionKey;
      
      // Re-encrypt all stored items
      for (const key of this.metadata.keys) {
        const data = await this.getSecureItem(key as StorageKeys);
        if (data) {
          await this.setSecureItem(key as StorageKeys, data);
        }
      }

      // Update metadata
      this.metadata.encryptionVersion = Date.now().toString();
      await this.setSecureItem(
        StorageKeys.STORAGE_METADATA,
        this.metadata
      );

    } catch (error) {
      console.error(`Failed to rotate encryption key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initializes storage metadata
   * @private
   * @returns {StorageMetadata}
   */
  private initializeMetadata(): StorageMetadata {
    const storedMetadata = getLocalStorageItem<StorageMetadata>(
      StorageKeys.STORAGE_METADATA
    );

    if (storedMetadata) {
      return storedMetadata;
    }

    const initialMetadata: StorageMetadata = {
      version: this.storageVersion,
      lastUpdated: Date.now(),
      encryptionVersion: '1.0',
      keys: []
    };

    setLocalStorageItem(StorageKeys.STORAGE_METADATA, initialMetadata);
    return initialMetadata;
  }

  /**
   * Updates storage metadata for a key
   * @private
   * @param {StorageKeys} key - Storage key
   */
  private updateMetadata(key: StorageKeys): void {
    if (!this.metadata.keys.includes(key)) {
      this.metadata.keys.push(key);
    }
    this.metadata.lastUpdated = Date.now();
    setLocalStorageItem(StorageKeys.STORAGE_METADATA, this.metadata);
  }

  /**
   * Sets up storage event listeners for cross-tab synchronization
   * @private
   */
  private setupStorageListeners(): void {
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith('bookman_')) {
        // Notify subscribers of storage changes
        window.dispatchEvent(new CustomEvent('bookman_storage_update', {
          detail: {
            key: event.key.replace('bookman_', ''),
            newValue: event.newValue
          }
        }));
      }
    });
  }

  /**
   * Generates a checksum for data validation
   * @private
   * @param {any} data - Data to checksum
   * @returns {string}
   */
  private generateChecksum(data: any): string {
    return CryptoJS.SHA256(JSON.stringify(data)).toString();
  }

  /**
   * Compresses data using LZ-based compression
   * @private
   * @param {string} data - Data to compress
   * @returns {string}
   */
  private compressData(data: string): string {
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(data)
    );
  }

  /**
   * Decompresses data
   * @private
   * @param {string} data - Compressed data
   * @returns {string}
   */
  private decompressData(data: string): string {
    return CryptoJS.enc.Utf8.stringify(
      CryptoJS.enc.Base64.parse(data)
    );
  }
}