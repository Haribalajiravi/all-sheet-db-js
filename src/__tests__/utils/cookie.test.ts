/**
 * Cookie utility tests
 */

import { setCookie, getCookie, deleteCookie, isCookieAvailable } from '../../utils/cookie';

describe('Cookie utilities', () => {
  beforeEach(() => {
    // Clear all cookies before each test
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  describe('isCookieAvailable', () => {
    it('should return true in browser environment', () => {
      expect(isCookieAvailable()).toBe(true);
    });
  });

  describe('setCookie', () => {
    it('should set a cookie', () => {
      setCookie('test', 'value');
      expect(getCookie('test')).toBe('value');
    });

    it('should set cookie with options', () => {
      // Avoid secure flag in test environment (http), only verify options handling
      setCookie('test', 'value', { path: '/' });
      expect(getCookie('test')).toBe('value');
    });
  });

  describe('getCookie', () => {
    it('should get a cookie value', () => {
      setCookie('test', 'value');
      expect(getCookie('test')).toBe('value');
    });

    it('should return null for non-existent cookie', () => {
      expect(getCookie('non-existent')).toBeNull();
    });
  });

  describe('deleteCookie', () => {
    it('should delete a cookie', () => {
      setCookie('test', 'value');
      expect(getCookie('test')).toBe('value');
      deleteCookie('test');
      expect(getCookie('test')).toBeNull();
    });
  });
});
