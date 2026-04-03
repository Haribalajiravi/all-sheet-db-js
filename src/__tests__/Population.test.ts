/**
 * Population unit tests
 */

import { ServiceManager } from '../core/ServiceManager';
import { cacheManager } from '../core/CacheManager';
import { ISpreadsheetService } from '../types/service.interface';
import {
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteResult,
  UpdateResult,
  AuthToken,
} from '../types';

class MockService implements ISpreadsheetService {
  readonly name = 'mock-service';

  async initialize(): Promise<void> {}
  async authenticate(): Promise<AuthToken> {
    return { accessToken: 'token', expiresAt: 0 };
  }
  async isAuthenticated(): Promise<boolean> {
    return true;
  }
  async refreshAuth(): Promise<AuthToken> {
    return { accessToken: 'token', expiresAt: 0 };
  }
  async store(): Promise<StoreResult> {
    return { success: true };
  }
  async deleteRows(): Promise<DeleteResult> {
    return { success: true };
  }
  async updateRows(): Promise<UpdateResult> {
    return { success: true };
  }
  async clearAuth(): Promise<void> {}
  async migrate(): Promise<any> {
    return { success: true };
  }

  async retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>> {
    const target = options.range || options.sheetName;

    if (target === 'Orders') {
      return {
        success: true,
        data: [
          { id: 1, customerId: 'C1', amount: 100 },
          { id: 2, customerId: 'C2', amount: 200 },
          { id: 3, customerId: 'C1', amount: 50 },
          { id: 4, customerId: 'C3', amount: 300 }, // Non-existent customer
        ] as T[],
      };
    }
    if (target === 'Customers') {
      return {
        success: true,
        data: [
          { id: 'C1', name: 'Alice' },
          { id: 'C2', name: 'Bob' },
        ] as T[],
      };
    }
    return { success: true, data: [] };
  }
}

describe('ServiceManager Population', () => {
  let serviceManager: ServiceManager;
  let mockService: MockService;

  beforeEach(() => {
    // Reset singleton state
    cacheManager.reset();

    // Mock all CacheManager methods globally for this test suite
    // to avoid IndexedDB timeouts in JSDOM
    jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
    jest.spyOn(cacheManager, 'set').mockResolvedValue();
    jest.spyOn(cacheManager, 'invalidateByPrefix').mockResolvedValue();
    jest.spyOn(cacheManager, 'clear').mockResolvedValue();
    jest.spyOn(cacheManager, 'getStats').mockResolvedValue({ size: 0, keys: [] });

    // Fallback IDB mock
    (window as any).indexedDB = { open: jest.fn().mockImplementation(() => ({})) };

    serviceManager = new ServiceManager();
    mockService = new MockService();
    serviceManager.registerService(mockService);
  });

  it('should populate related data from another sheet', async () => {
    const result = await serviceManager.retrieve({
      sheetName: 'Orders',
      populate: [
        {
          localField: 'customerId',
          from: 'Customers',
          foreignField: 'id',
          as: 'customer',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4);

    // Alice
    expect(result.data![0]).toEqual({
      id: 1,
      customerId: 'C1',
      amount: 100,
      customer: { id: 'C1', name: 'Alice' },
    });

    // Bob
    expect(result.data![1]).toEqual({
      id: 2,
      customerId: 'C2',
      amount: 200,
      customer: { id: 'C2', name: 'Bob' },
    });

    // Alice again
    expect(result.data![2]).toEqual({
      id: 3,
      customerId: 'C1',
      amount: 50,
      customer: { id: 'C1', name: 'Alice' },
    });

    // Non-existent customer
    expect(result.data![3]).toEqual({
      id: 4,
      customerId: 'C3',
      amount: 300,
      customer: null,
    });
  });

  it('should support multiple population fields', async () => {
    mockService.retrieve = jest.fn().mockImplementation(async (options: RetrieveOptions) => {
      const target = options.range || options.sheetName;
      if (target === 'Products') {
        return {
          success: true,
          data: [
            { id: 'P1', name: 'Laptop', catId: 'Cat1' },
            { id: 'P2', name: 'Phone', catId: 'Cat2' },
          ],
        };
      }
      if (target === 'Categories') {
        return {
          success: true,
          data: [
            { id: 'Cat1', title: 'Electronics' },
            { id: 'Cat2', title: 'Mobile' },
          ],
        };
      }
      return { success: true, data: [] };
    });

    const result = await serviceManager.retrieve({
      sheetName: 'Products',
      populate: [
        {
          localField: 'catId',
          from: 'Categories',
          foreignField: 'id',
          as: 'category',
        },
      ],
    });

    expect((result.data![0] as any).category.title).toBe('Electronics');
    expect((result.data![1] as any).category.title).toBe('Mobile');
  });
});
