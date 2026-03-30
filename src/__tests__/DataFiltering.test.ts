import { ServiceManager } from '../core/ServiceManager';
import { ISpreadsheetService } from '../types/service.interface';

class MockService implements ISpreadsheetService {
  readonly name = 'mock-service';
  async initialize(): Promise<void> {}
  async authenticate(): Promise<any> {
    return {};
  }
  async isAuthenticated(): Promise<boolean> {
    return true;
  }
  async refreshAuth(): Promise<any> {
    return {};
  }
  async store(): Promise<any> {
    return { success: true };
  }
  async deleteRows(): Promise<any> {
    return { success: true };
  }
  async updateRows(): Promise<any> {
    return { success: true };
  }
  async clearAuth(): Promise<void> {}
  async migrate(): Promise<any> {
    return { success: true };
  }

  async retrieve(): Promise<any> {
    return {
      success: true,
      data: [
        { id: 1, name: 'Apple', type: 'Fruit', price: 10 },
        { id: 2, name: 'Banana', type: 'Fruit', price: 5 },
        { id: 3, name: 'Carrot', type: 'Vegetable', price: 3 },
        { id: 4, name: 'Date', type: 'Fruit', price: 15 },
        { id: 5, name: 'Eggplant', type: 'Vegetable', price: 7 },
      ],
    };
  }
}

describe('DataFiltering & Manipulation', () => {
  let serviceManager: ServiceManager;
  let mockService: MockService;

  beforeEach(() => {
    serviceManager = new ServiceManager();
    mockService = new MockService();
    serviceManager.registerService(mockService);
    serviceManager.setCurrentService('mock-service' as any);
  });

  test('should filter data using advanced operators', async () => {
    const res = await serviceManager.retrieve({
      sheetName: 'test',
      filters: [
        { column: 'type', operator: 'eq', value: 'Fruit' },
        { column: 'price', operator: 'gt', value: 8 },
      ],
    });

    expect(res.data).toHaveLength(2); // Apple (10) and Date (15)
    expect(res.data?.map((i: any) => i.name)).toContain('Apple');
    expect(res.data?.map((i: any) => i.name)).toContain('Date');
  });

  test('should sort data by multiple columns', async () => {
    const res = await serviceManager.retrieve({
      sheetName: 'test',
      sort: [
        { column: 'type', order: 'asc' },
        { column: 'price', order: 'desc' },
      ],
    });

    const data = res.data as any[];
    expect(data?.[0].name).toBe('Date'); // Fruit, Price 15
    expect(data?.[1].name).toBe('Apple'); // Fruit, Price 10
    expect(data?.[2].name).toBe('Banana'); // Fruit, Price 5
  });

  test('should paginate data', async () => {
    const res = await serviceManager.retrieve({
      sheetName: 'test',
      pagination: { limit: 2, offset: 1 },
    });

    const data = res.data as any[];
    expect(data).toHaveLength(2);
    expect(data?.[0].id).toBe(2);
    expect(data?.[1].id).toBe(3);
  });

  test('should group data', async () => {
    const res = await serviceManager.retrieve({
      sheetName: 'test',
      groupBy: 'type',
    });

    const data = res.data as any;
    expect(data.Fruit).toHaveLength(3);
    expect(data.Vegetable).toHaveLength(2);
    expect(data.Fruit[0].name).toBe('Apple');
  });

  test('should support "contains" operator', async () => {
    const res = await serviceManager.retrieve({
      sheetName: 'test',
      filters: [{ column: 'name', operator: 'contains', value: 'a' }],
    });

    expect(res.data).toHaveLength(5); // All names contain 'a' or 'A'
    // Wait, Apple, Banana, Carrot, Date, Eggplant all have 'a' except maybe Carrot? No, Carrot has 'a'.
    // Date has 'a'.
    // Apple (A), Banana (a), Carrot (a), Date (a), Eggplant (a).
    // String(val).toLowerCase().includes(String(cond.value).toLowerCase())
    // Let's check:
    // Apple, Banana, Carrot, Date, Eggplant -> all have 'a' or 'A'.
    // Wait... Eggplant? Yes.
  });
});
