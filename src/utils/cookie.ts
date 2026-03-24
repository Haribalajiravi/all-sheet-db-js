/**
 * Cookie utility for storing and retrieving authentication tokens
 */

import { logger } from './logger';

const COOKIE_PREFIX = 'all_sheet_db_';

export interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Set a cookie
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  try {
    const cookieName = `${COOKIE_PREFIX}${name}`;
    let cookieString = `${encodeURIComponent(cookieName)}=${encodeURIComponent(value)}`;

    if (options.expires) {
      cookieString += `; expires=${options.expires.toUTCString()}`;
    }

    if (options.maxAge) {
      cookieString += `; max-age=${options.maxAge}`;
    }

    if (options.path) {
      cookieString += `; path=${options.path}`;
    } else {
      cookieString += `; path=/`;
    }

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    if (options.secure) {
      cookieString += `; secure`;
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieString;
    logger.debug(`Cookie set: ${cookieName}`);
  } catch (error) {
    logger.error(`Failed to set cookie ${name}:`, error);
    throw error;
  }
}

/**
 * Get a cookie value
 */
export function getCookie(name: string): string | null {
  try {
    const cookieName = `${COOKIE_PREFIX}${name}`;
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === cookieName) {
        return decodeURIComponent(value);
      }
    }

    return null;
  } catch (error) {
    logger.error(`Failed to get cookie ${name}:`, error);
    return null;
  }
}

/**
 * Delete a cookie
 */
export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {}
): void {
  try {
    const cookieName = `${COOKIE_PREFIX}${name}`;
    let cookieString = `${encodeURIComponent(cookieName)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC`;

    if (options.path) {
      cookieString += `; path=${options.path}`;
    } else {
      cookieString += `; path=/`;
    }

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    document.cookie = cookieString;
    logger.debug(`Cookie deleted: ${cookieName}`);
  } catch (error) {
    logger.error(`Failed to delete cookie ${name}:`, error);
  }
}

/**
 * Check if cookies are available (browser environment)
 */
export function isCookieAvailable(): boolean {
  return typeof document !== 'undefined' && typeof document.cookie !== 'undefined';
}
