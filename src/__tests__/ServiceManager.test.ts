/**
 * ServiceManager unit tests
 */

import { ServiceManager } from '../core/ServiceManager';
import { cacheManager } from '../core/CacheManager';
import { ISpreadsheetService } from '../types/service.interface';
import {
  IntegrationConfig,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
  ServiceType,
  AuthToken,
} from '../types';

class MockService implements ISpreadsheetService {
  readonly name = 'mock-service';
  private authenticated = false;

  async initialize(_config: Record<string, unknown>): Promise<void> {
    // mock initialize
  }

  async authenticate(): Promise<AuthToken> {
    this.authenticated = true;
    return { accessToken: 'mock-token', expiresAt: Date.now() + 3600 };
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authenticated;
  }

  async refreshAuth(): Promise<AuthToken> {
    return { accessToken: 'refreshed-token', expiresAt: Date.now() + 3600 };
  }

  async store<T = unknown>(data: T[], _options: StoreOptions): Promise<StoreResult> {
    return { success: true, rowsAffected: data.length };
  }

  async retrieve<T = unknown>(_options: RetrieveOptions): Promise<RetrieveResult<T>> {
    return { success: true, data: [] as T[] };
  }

  async deleteRows<T = unknown>(_options: DeleteOptions<T>): Promise<DeleteResult> {
    return { success: true, deletedCount: 1 };
  }

  async updateRows<T = unknown>(_options: UpdateOptions<T>): Promise<UpdateResult> {
    return { success: true, updatedCount: 1 };
  }

  async clearAuth(): Promise<void> {
    this.authenticated = false;
  }

  async migrate(_options: any): Promise<any> {
    return { success: true, fromVersion: 0, toVersion: 0, appliedMigrations: 0 };
  }
}

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;
  let mockService: MockService;

  beforeEach(() => {
    serviceManager = new ServiceManager();
    mockService = new MockService();
  });

  describe('registerService', () => {
    it('should register a service', () => {
      serviceManager.registerService(mockService);
      expect(serviceManager.getRegisteredServices()).toContain('mock-service' as ServiceType);
    });
  });

  describe('setCurrentService', () => {
    it('should set the current service', () => {
      serviceManager.registerService(mockService);
      serviceManager.setCurrentService('mock-service' as ServiceType);
      expect(serviceManager.getCurrentService()).toBe(mockService);
    });

    it('should throw error if service is not registered', () => {
      expect(() => {
        serviceManager.setCurrentService('non-existent' as ServiceType);
      }).toThrow();
    });
  });

  describe('initialize', () => {
    it('should initialize enabled services', async () => {
      serviceManager.registerService(mockService);
      const config: IntegrationConfig = {
        services: [
          {
            name: 'mock-service' as ServiceType,
            enabled: true,
          },
        ],
      };

      await serviceManager.initialize(config);
      // If no error is thrown, initialization succeeded
      expect(true).toBe(true);
    });

    it('should skip disabled services', async () => {
      serviceManager.registerService(mockService);
      const config: IntegrationConfig = {
        services: [
          {
            name: 'mock-service' as ServiceType,
            enabled: false,
          },
        ],
      };

      await serviceManager.initialize(config);
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('store', () => {
    it('should store data using current service', async () => {
      serviceManager.registerService(mockService);
      serviceManager.setCurrentService('mock-service' as ServiceType);

      const result = await serviceManager.store([{ id: 1, name: 'Test' }], {
        sheetName: 'test-sheet',
      });

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should throw error if no service is selected', async () => {
      await expect(serviceManager.store([{ id: 1 }], { sheetName: 'test' })).rejects.toThrow();
    });

    it('should auto-select the only registered service when current is unset', async () => {
      serviceManager.registerService(mockService);
      const result = await serviceManager.store([{ id: 1 }], { sheetName: 'test-sheet' });
      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });
  });

  describe('retrieve', () => {
    it('should retrieve data using current service', async () => {
      serviceManager.registerService(mockService);
      serviceManager.setCurrentService('mock-service' as ServiceType);

      const result = await serviceManager.retrieve({
        sheetName: 'test-sheet',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should throw error if no service is selected', async () => {
      await expect(serviceManager.retrieve({ sheetName: 'test' })).rejects.toThrow();
    });

    it('should auto-select the only registered service when current is unset', async () => {
      serviceManager.registerService(mockService);
      const result = await serviceManager.retrieve({ sheetName: 'test-sheet' });
      expect(result.success).toBe(true);
    });

    it('should use cache when enabled and hit occurs', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'cached-sheet';
      const cachedData = [{ id: 1, cached: true }];
      
      const spySet = jest.spyOn(cacheManager, 'set');
      const spyGet = jest.spyOn(cacheManager, 'get').mockReturnValue(cachedData);
      
      const result = await serviceManager.retrieve({
        sheetName,
        cache: { enabled: true }
      });
      
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(spyGet).toHaveBeenCalled();
      
      spyGet.mockRestore();
      spySet.mockRestore();
    });

    it('should fetch from service and save to cache on miss', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'miss-sheet';
      const freshData = [{ id: 1, fresh: true }];
      
      jest.spyOn(mockService, 'retrieve').mockResolvedValue({ success: true, data: freshData });
      const spySet = jest.spyOn(cacheManager, 'set').mockImplementation(() => {});
      const spyGet = jest.spyOn(cacheManager, 'get').mockReturnValue(null);
      
      const result = await serviceManager.retrieve({
        sheetName,
        cache: { enabled: true }
      });
      
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.data).toEqual(freshData);
      expect(spyGet).toHaveBeenCalled();
      expect(spySet).toHaveBeenCalled();
      
      spyGet.mockRestore();
      spySet.mockRestore();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache when storing data', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'invalidate-sheet';
      const spyInvalidate = jest.spyOn(cacheManager, 'invalidateByPrefix').mockImplementation(() => {});
      
      await serviceManager.store([{ id: 1 }], { sheetName });
      
      expect(spyInvalidate).toHaveBeenCalledWith(expect.stringContaining(sheetName));
      spyInvalidate.mockRestore();
    });

    it('should invalidate cache when deleting rows', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'delete-sheet';
      const spyInvalidate = jest.spyOn(cacheManager, 'invalidateByPrefix').mockImplementation(() => {});
      
      await serviceManager.deleteRows({ sheetName, where: () => true });
      
      expect(spyInvalidate).toHaveBeenCalledWith(expect.stringContaining(sheetName));
      spyInvalidate.mockRestore();
    });

    it('should invalidate cache when updating rows', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'update-sheet';
      const spyInvalidate = jest.spyOn(cacheManager, 'invalidateByPrefix').mockImplementation(() => {});
      
      await serviceManager.updateRows({ sheetName, where: () => true, set: (r) => r });
      
      expect(spyInvalidate).toHaveBeenCalledWith(expect.stringContaining(sheetName));
      spyInvalidate.mockRestore();
    });
  });

  describe('migrate', () => {
    it('should delegate migration to current service', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'migrate-sheet';
      const migrations = [{ version: 1, description: 'v1', actions: [] }];
      
      const spyMigrate = jest.spyOn(mockService, 'migrate').mockResolvedValue({
        success: true,
        fromVersion: 0,
        toVersion: 1,
        appliedMigrations: 1
      });
      
      const result = await serviceManager.migrate({
        spreadsheetId: 'spread-id',
        sheetName,
        migrations
      });
      
      expect(result.success).toBe(true);
      expect(result.toVersion).toBe(1);
      expect(spyMigrate).toHaveBeenCalled();
      spyMigrate.mockRestore();
    });

    it('should invalidate cache after successful migration', async () => {
      serviceManager.registerService(mockService);
      const sheetName = 'invalidate-migrate-sheet';
      
      jest.spyOn(mockService, 'migrate').mockResolvedValue({
        success: true,
        fromVersion: 0,
        toVersion: 1,
        appliedMigrations: 1
      });
      
      const spyInvalidate = jest.spyOn(cacheManager, 'invalidateByPrefix').mockImplementation(() => {});
      
      await serviceManager.migrate({
        spreadsheetId: 'spread-id',
        sheetName,
        migrations: []
      });
      
      expect(spyInvalidate).toHaveBeenCalledWith(expect.stringContaining(sheetName));
      spyInvalidate.mockRestore();
    });

    it('should not invalidate cache if migration fails', async () => {
      serviceManager.registerService(mockService);
      
      jest.spyOn(mockService, 'migrate').mockResolvedValue({
        success: false,
        fromVersion: 0,
        toVersion: 0,
        appliedMigrations: 0,
        error: 'Failed'
      });
      
      const spyInvalidate = jest.spyOn(cacheManager, 'invalidateByPrefix').mockImplementation(() => {});
      
      await serviceManager.migrate({
        spreadsheetId: 'spread-id',
        sheetName: 'fail-sheet',
        migrations: []
      });
      
      expect(spyInvalidate).not.toHaveBeenCalled();
      spyInvalidate.mockRestore();
    });
  });
});
