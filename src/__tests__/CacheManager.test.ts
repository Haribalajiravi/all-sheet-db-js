import { CacheManager } from '../core/CacheManager';

// synchronous IndexedDB Mock for easy testing
class IDBRequestMock {
  onsuccess: any = null;
  onerror: any = null;
  result: any = null;
  error: any = null;

  static createSuccess(result: any) {
    const req = new IDBRequestMock();
    req.result = result;
    // We'll trigger onsuccess manually in the caller to control timing
    return req;
  }
}

class IDBTransactionMock {
  oncomplete: any = null;
  objectStore = jest.fn();
}

describe('CacheManager (IndexedDB Mock)', () => {
  let cacheManager: CacheManager;
  let store: Record<string, any> = {};

  beforeEach(() => {
    cacheManager = new CacheManager();
    store = {};

    const mockOS = {
      put: jest.fn((data, key) => {
        store[key] = data;
        const req = IDBRequestMock.createSuccess(key);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      get: jest.fn(key => {
        const req = IDBRequestMock.createSuccess(store[key]);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      delete: jest.fn(key => {
        delete store[key];
        const req = IDBRequestMock.createSuccess(undefined);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      clear: jest.fn(() => {
        store = {};
        const req = IDBRequestMock.createSuccess(undefined);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      openCursor: jest.fn(range => {
        const req = new IDBRequestMock();
        const allKeys = Object.keys(store).sort();
        let filteredKeys = allKeys;

        if (range && range.lower) {
          filteredKeys = allKeys.filter(
            k => k >= range.lower && (!range.upper || k <= range.upper)
          );
        }

        let index = 0;
        const iterate = () => {
          if (index < filteredKeys.length) {
            req.result = {
              key: filteredKeys[index],
              toString: () => filteredKeys[index],
              continue: () => {
                index++;
                iterate();
              },
            };
          } else {
            req.result = null;
          }
          req.onsuccess?.({ target: req });
        };
        setTimeout(iterate, 0);
        return req;
      }),
    };

    const mockDB = {
      transaction: jest.fn(() => {
        const trans = new IDBTransactionMock();
        trans.objectStore.mockReturnValue(mockOS);
        return trans;
      }),
      objectStoreNames: { contains: () => true },
      close: jest.fn(),
    };

    // Set Up globals
    (global as any).IDBKeyRange = {
      bound: jest.fn((lower, upper) => ({ lower, upper })),
    };

    (window as any).indexedDB = {
      open: jest.fn(() => {
        const req = IDBRequestMock.createSuccess(mockDB);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
    };

    // We MUST use real timers for this to work with the setTimeouts in our mock
    jest.useRealTimers();
  });

  test('should set and get a value', async () => {
    const key = 'test-key';
    const data = { foo: 'bar' };

    await cacheManager.set(key, data);
    const retrieved = await cacheManager.get<{ foo: string }>(key);

    expect(retrieved).toEqual(data);
  });

  test('should return null for non-existent key', async () => {
    const retrieved = await cacheManager.get('non-existent');
    expect(retrieved).toBeNull();
  });

  test('should return null if expired', async () => {
    const key = 'expired-key';
    const data = { test: 123 };
    const ttl = 100; // 100ms

    await cacheManager.set(key, data);

    // Wait for TTL
    await new Promise(resolve => setTimeout(resolve, ttl + 50));

    const retrieved = await cacheManager.get(key, ttl);
    expect(retrieved).toBeNull();
  });

  test('should invalidate by prefix', async () => {
    await cacheManager.set('gs:sheet1:q1', { data: 1 });
    await cacheManager.set('gs:sheet1:q2', { data: 2 });
    await cacheManager.set('gs:sheet2:q1', { data: 3 });

    await cacheManager.invalidateByPrefix('gs:sheet1');

    expect(await cacheManager.get('gs:sheet1:q1')).toBeNull();
    expect(await cacheManager.get('gs:sheet1:q2')).toBeNull();
    expect(await cacheManager.get('gs:sheet2:q1')).not.toBeNull();
  });

  test('should clear all cache entries', async () => {
    await cacheManager.set('key1', { a: 1 });
    await cacheManager.set('key2', { b: 2 });

    await cacheManager.clear();

    expect(await cacheManager.get('key1')).toBeNull();
    expect(await cacheManager.get('key2')).toBeNull();
  });
});
