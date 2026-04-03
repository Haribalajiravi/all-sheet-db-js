/**
 * Cache Manager - Handles asynchronous caching for spreadsheet data using IndexedDB.
 * Improved storage limits and performance compared to localStorage.
 */

import { logger } from '../utils/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheManager {
  private static readonly DB_NAME = 'AllSheetDB_Cache';
  private static readonly STORE_NAME = 'spreadsheet_cache';
  private static readonly DB_VERSION = 1;
  private static readonly DEFAULT_TTL = 300000; // 5 minutes

  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Reset the DB connection (primarily for testing)
   */
  reset(): void {
    this.dbPromise = null;
  }

  /**
   * Get or initialize the IndexedDB connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available in this environment.');
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(CacheManager.DB_NAME, CacheManager.DB_VERSION);

        request.onerror = () => {
          logger.error('Failed to open IndexedDB for caching');
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(CacheManager.STORE_NAME)) {
            db.createObjectStore(CacheManager.STORE_NAME);
          }
        };
      } catch (err) {
        logger.error('Error initiating IndexedDB open:', err);
        reject(err);
      }
    });

    return this.dbPromise;
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, data: T): Promise<void> {
    try {
      const db = await this.getDB();
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.put(entry, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.warn(`Failed to set cache for key ${key}:`, error);
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string, ttl: number = CacheManager.DEFAULT_TTL): Promise<T | null> {
    try {
      const db = await this.getDB();

      const entry = await new Promise<CacheEntry<T> | null>((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (!entry) return null;

      const isExpired = Date.now() - entry.timestamp > ttl;
      if (isExpired) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      logger.warn(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get the timestamp of a cache entry
   */
  async getTimestamp(key: string): Promise<number | null> {
    try {
      const db = await this.getDB();
      const entry = await new Promise<CacheEntry<unknown> | null>((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      return entry?.timestamp || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.warn(`Failed to delete cache key ${key}:`, error);
    }
  }

  /**
   * Delete all cache entries starting with a specific prefix
   */
  async invalidateByPrefix(partialKey: string): Promise<void> {
    try {
      const db = await this.getDB();
      const keysToRemove: string[] = [];

      // Use a bound range for efficient prefix matching
      // Since keys are strings like "service:sheetId:options", this works perfectly.
      const range = IDBKeyRange.bound(partialKey, partialKey + '\uffff');

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CacheManager.STORE_NAME);

        // Use openCursor instead of openKeyCursor for better compatibility
        const request = store.openCursor(range);

        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            keysToRemove.push(cursor.key.toString());
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });

      if (keysToRemove.length > 0) {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        await Promise.all(
          keysToRemove.map(key => {
            return new Promise((resolve, reject) => {
              const req = store.delete(key);
              req.onsuccess = () => resolve(true);
              req.onerror = () => reject(req.error);
            });
          })
        );
        logger.debug(`Invalidated ${keysToRemove.length} cache entries for prefix: ${partialKey}`);
      }
    } catch (error) {
      logger.warn(`Failed to invalidate cache for prefix ${partialKey}:`, error);
    }
  }

  /**
   * Clear all cache entries for this library
   */
  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          logger.info('Cache cleared successfully');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Generate a unique key for a request.
   * Performs deep sorting of the options object to ensure stable keys.
   */
  generateKey(serviceName: string, sheetName: string, options: Record<string, unknown>): string {
    const normalize = (val: any): any => {
      if (val === null || typeof val !== 'object') {
        return val;
      }

      // Handle Date objects explicitly
      if (val instanceof Date) {
        return val.toISOString();
      }

      if (Array.isArray(val)) {
        return val.map(normalize);
      }

      // If it's a non-plain object (has a different constructor than Object),
      // but not a Date/Array, we check if it has a toJSON method
      if (val.constructor !== Object && typeof val.toJSON === 'function') {
        return normalize(val.toJSON());
      }

      const sortedObj: any = {};
      Object.keys(val)
        .sort()
        .forEach(k => {
          if (k !== 'cache' && typeof val[k] !== 'function' && val[k] !== undefined) {
            sortedObj[k] = normalize(val[k]);
          }
        });
      return sortedObj;
    };

    const normalizedOptions = normalize(options);
    return `${serviceName}:${sheetName}:${JSON.stringify(normalizedOptions)}`;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; keys: string[] }> {
    try {
      const db = await this.getDB();
      const keys: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([CacheManager.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CacheManager.STORE_NAME);
        const request = store.openKeyCursor();

        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            keys.push(cursor.key.toString());
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });

      return { size: keys.length, keys };
    } catch (error) {
      return { size: 0, keys: [] };
    }
  }
}

export const cacheManager = new CacheManager();
