/**
 * Real-world expense table schema for Google Sheets via all-sheet-db-js.
 * Column order matches the sheet (left → right).
 */
import type { SheetModel } from '../../../src/types';

/** One expense row stored in the spreadsheet */
export interface Expense {
  expense_id: string;
  date: string;
  category: string;
  amount_usd: number;
  gst_tax: number;
  total_price: number; // computed by formula in the sheet
  merchant: string;
  notes: string;
}

/**
 * Tab name and column definitions used by store/retrieve.
 *
 * Column order (A → H):
 *   A: date
 *   B: category
 *   C: amount_usd
 *   D: gst_tax
 *   E: total_price  ← formula: =INDIRECT("C"&ROW())+INDIRECT("D"&ROW())
 *   F: merchant
 *   G: notes
 *   H: expense_id
 *
 * The formula uses INDIRECT("C"&ROW()) so it always references the CURRENT row,
 * making it safe for appended rows (no row-number bookkeeping needed).
 */
export const EXPENSE_SHEET_MODEL: SheetModel = {
  sheetName: 'Expenses',
  columns: [
    { name: 'date', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'amount_usd', type: 'number' },
    { name: 'gst_tax', type: 'number' },
    {
      name: 'total_price',
      type: 'formula',
      formula: '=INDIRECT("C"&ROW())+INDIRECT("D"&ROW())',
    },
    { name: 'merchant', type: 'string' },
    { name: 'notes', type: 'string' },
    { name: 'expense_id', type: 'string' },
  ],
};

/**
 * One-time header row (human-readable labels in every column).
 * Row 0 is skipped on retrieve by the library, so string in `amount_usd` is fine for the sheet.
 */
export const EXPENSE_HEADER_ROW = {
  expense_id: 'Expense ID',
  date: 'Date',
  category: 'Category',
  amount_usd: 'Amount (USD)',
  gst_tax: 'GST Tax',
  total_price: 'Total Price',
  merchant: 'Merchant',
  notes: 'Notes',
} as unknown as Expense;

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Utilities',
  'Shopping',
  'Healthcare',
  'Entertainment',
  'Other',
] as const;

export function newExpenseId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Header cells in column order for `ensureSheetHeaderRow` */
export function expenseHeaderValues(): unknown[] {
  const labels = EXPENSE_HEADER_ROW as Record<string, unknown>;
  return EXPENSE_SHEET_MODEL.columns.map(c => labels[c.name] ?? '');
}
