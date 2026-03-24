/**
 * Data conversion between typed objects and Google Sheets row arrays.
 *
 * These functions map between `T[]` (typed domain objects) and
 * `unknown[][]` (the row/column grid the Sheets API expects).
 */

import type { ColumnDefinition } from '../../types';

/**
 * Convert an array of typed objects into row arrays suitable for the
 * Sheets `values.update` / `values.append` API.
 *
 * When a column has `type: 'formula'`, the cell value is taken from
 * `column.formula` and the data object's value is ignored.
 */
export function convertDataToRows<T>(
  data: T[],
  model?: { columns: ColumnDefinition[] }
): unknown[][] {
  if (!model || !model.columns.length) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return Object.values(item);
      }
      return [item];
    });
  }

  return data.map(item => {
    const row: unknown[] = [];
    for (const column of model.columns) {
      if (column.type === 'formula' && column.formula) {
        row.push(column.formula);
      } else if (typeof item === 'object' && item !== null) {
        row.push((item as Record<string, unknown>)[column.name] ?? column.defaultValue ?? '');
      } else {
        row.push(item);
      }
    }
    return row;
  });
}

/**
 * Convert raw Sheets row arrays into typed objects.
 *
 * The first row is assumed to be the header and is **skipped**.
 * Each subsequent row is mapped to an object whose keys come from
 * `model.columns[].name` with type-aware coercion.
 */
export function convertRowsToData<T>(
  rows: unknown[][],
  model?: { columns: ColumnDefinition[] }
): T[] {
  if (!rows.length) {
    return [];
  }

  if (!model || !model.columns.length) {
    return rows as T[];
  }

  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const obj: Record<string, unknown> = {};
    model.columns.forEach((column, index) => {
      const value = row[index];
      if (column.type === 'number' && value !== undefined && value !== null) {
        obj[column.name] = Number(value);
      } else if (column.type === 'formula' && value !== undefined && value !== null) {
        const num = Number(value);
        obj[column.name] = Number.isFinite(num) ? num : value;
      } else if (column.type === 'boolean' && value !== undefined && value !== null) {
        obj[column.name] = String(value).toLowerCase() === 'true';
      } else if (column.type === 'date' && value !== undefined && value !== null) {
        obj[column.name] = new Date(String(value));
      } else {
        obj[column.name] = value ?? column.defaultValue ?? '';
      }
    });
    return obj as T;
  });
}
