import { cacheManager } from '../core/CacheManager';

describe('CacheManager', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = (function() {
      let store: { [key: string]: string } = {};
      return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value.toString();
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        }),
        key: jest.fn((index: number) => Object.keys(store)[index] || null),
        get length() {
          return Object.keys(store).length;
        }
      };
    })();

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('should set and get a value', () => {
    const key = 'test-key';
    const data = { foo: 'bar' };
    
    cacheManager.set(key, data);
    const retrieved = cacheManager.get<{ foo: string }>(key);
    
    expect(retrieved).toEqual(data);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining(key),
      expect.any(String)
    );
  });

  test('should return null for non-existent key', () => {
    expect(cacheManager.get('non-existent')).toBeNull();
  });

  test('should return null and delete item if expired', () => {
    const key = 'expired-key';
    const data = { test: 123 };
    const ttl = 1000; // 1 second

    cacheManager.set(key, data);
    
    // Advance time past TTL
    jest.advanceTimersByTime(ttl + 100);
    
    const retrieved = cacheManager.get(key, ttl);
    expect(retrieved).toBeNull();
    expect(window.localStorage.removeItem).toHaveBeenCalled();
  });

  test('should invalidate by prefix', () => {
    cacheManager.set('service:sheet1:q1', { data: 1 });
    cacheManager.set('service:sheet1:q2', { data: 2 });
    cacheManager.set('service:sheet2:q1', { data: 3 });

    cacheManager.invalidateByPrefix('service:sheet1');

    expect(cacheManager.get('service:sheet1:q1')).toBeNull();
    expect(cacheManager.get('service:sheet1:q2')).toBeNull();
    expect(cacheManager.get('service:sheet2:q1')).not.toBeNull();
  });

  test('should clear all cache entries', () => {
    cacheManager.set('key1', { a: 1 });
    cacheManager.set('key2', { b: 2 });
    
    // Add a non-library item to ensure we don't clear everything
    window.localStorage.setItem('other-key', 'other-value');

    cacheManager.clear();

    expect(cacheManager.get('key1')).toBeNull();
    expect(cacheManager.get('key2')).toBeNull();
    expect(window.localStorage.getItem('other-key')).toBe('other-value');
  });

  test('should generate consistent keys', () => {
    const service = 'gs';
    const sheet = 'mysheet';
    const options1 = { range: 'A1:B2', filters: { id: 1 } };
    const options2 = { filters: { id: 1 }, range: 'A1:B2' }; // different order

    const key1 = cacheManager.generateKey(service, sheet, options1);
    const key2 = cacheManager.generateKey(service, sheet, options2);

    expect(key1).toBe(key2);
    expect(key1).toContain(service);
    expect(key1).toContain(sheet);
  });
});
