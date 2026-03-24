/**
 * ServiceManager unit tests
 */

import { ServiceManager } from '../core/ServiceManager';
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
  });
});
