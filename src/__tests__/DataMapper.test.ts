import { convertRowsToData, convertDataToRows } from '../services/google-sheets/data-mapper';

describe('DataMapper', () => {
  describe('convertRowsToData', () => {
    test('should map rows using header when model is missing', () => {
      const rows = [
        ['id', 'name', 'extra'],
        ['1', 'John', 'foo'],
        ['2', 'Jane', 'bar']
      ];
      
      const result = convertRowsToData<any>(rows);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'John', extra: 'foo' });
      expect(result[1]).toEqual({ id: '2', name: 'Jane', extra: 'bar' });
    });

    test('should handle missing values in rows', () => {
      const rows = [
        ['id', 'name'],
        ['1'],
        ['2', 'Jane', 'ignored']
      ];
      
      const result = convertRowsToData<any>(rows);
      
      expect(result[0]).toEqual({ id: '1', name: '' });
      expect(result[1]).toEqual({ id: '2', name: 'Jane' });
    });

    test('should use model if provided', () => {
      const rows = [
        ['ignored-header', 'ignored-header'],
        ['1', '123']
      ];
      const model = {
        columns: [
          { name: 'id', type: 'string' as const },
          { name: 'val', type: 'number' as const }
        ]
      };
      
      const result = convertRowsToData<any>(rows, model);
      
      expect(result[0]).toEqual({ id: '1', val: 123 });
    });
  });

  describe('convertDataToRows', () => {
    test('should convert objects to rows without model', () => {
      const data = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
      const result = convertDataToRows(data);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });

    test('should convert objects to rows with model', () => {
      const data = [{ name: 'John', age: 30 }];
      const model = {
        columns: [
          { name: 'age', type: 'number' as const },
          { name: 'name', type: 'string' as const }
        ]
      };
      const result = convertDataToRows(data, model);
      expect(result).toEqual([[30, 'John']]);
    });
  });
});
