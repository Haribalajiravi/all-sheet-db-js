/**
 * Cache Manager - Handles caching for spreadsheet data
 */

import { logger } from '../utils/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheManager {
  private static readonly PREFIX = 'all_sheet_db_cache:';
  private static readonly DEFAULT_TTL = 300000; // 5 minutes

  /**
   * Check if localStorage is available
   */
  private isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, data: T): void {
    if (!this.isAvailable()) return;

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.getPrefixedKey(key), JSON.stringify(entry));
    } catch (error) {
      logger.warn(`Failed to set cache for key ${key}:`, error);
    }
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string, ttl: number = CacheManager.DEFAULT_TTL): T | null {
    if (!this.isAvailable()) return null;

    try {
      const item = localStorage.getItem(this.getPrefixedKey(key));
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      const isExpired = Date.now() - entry.timestamp > ttl;

      if (isExpired) {
        this.delete(key);
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
  getTimestamp(key: string): number | null {
    if (!this.isAvailable()) return null;

    try {
      const item = localStorage.getItem(this.getPrefixedKey(key));
      if (!item) return null;

      const entry: CacheEntry<unknown> = JSON.parse(item);
      return entry.timestamp;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.getPrefixedKey(key));
  }

  /**
   * Delete all cache entries starting with a specific prefix
   */
  invalidateByPrefix(partialKey: string): void {
    if (!this.isAvailable()) return;

    const fullPrefix = this.getPrefixedKey(partialKey);
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(fullPrefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      logger.debug(`Invalidated ${keysToRemove.length} cache entries for prefix: ${partialKey}`);
    }
  }

  /**
   * Clear all cache entries for this library
   */
  clear(): void {
    if (!this.isAvailable()) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CacheManager.PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    logger.info(`Cleared ${keysToRemove.length} cache entries`);
  }

  /**
   * Generate a unique key for a request
   */
  generateKey(serviceName: string, sheetName: string, options: Record<string, unknown>): string {
    // Basic key generation: service:sheetName:JSON_of_options
    // We sort keys to ensure consistent hash
    const sortedOptions = Object.keys(options)
      .sort()
      .reduce((acc, key) => {
        if (key !== 'cache') {
          // Don't include cache options themselves in the key
          acc[key] = options[key];
        }
        return acc;
      }, {} as any);

    return `${serviceName}:${sheetName}:${JSON.stringify(sortedOptions)}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    if (!this.isAvailable()) return { size: 0, keys: [] };

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CacheManager.PREFIX)) {
        keys.push(key.replace(CacheManager.PREFIX, ''));
      }
    }
    return { size: keys.length, keys };
  }

  private getPrefixedKey(key: string): string {
    return `${CacheManager.PREFIX}${key}`;
  }
}

export const cacheManager = new CacheManager();
