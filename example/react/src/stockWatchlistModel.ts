/**
 * Stock Watchlist schema for Google Sheets via all-sheet-db-js.
 *
 * Only the `ticker` column is user-supplied. All other fields are
 * auto-populated by GOOGLEFINANCE formulas that reference the NSE
 * (National Stock Exchange of India) ticker in column A.
 */
import type { SheetModel } from '../../../src/types';

/** One watchlist row stored in the spreadsheet */
export interface Stock {
  ticker: string;
  stock_name: string | number;
  current_price: number;
  low_52w: number;
  high_52w: number;
  industry_avg_pe: number;
  current_pe: number;
  current_book_value: number;
  today_change_pct: number;
}

/**
 * Column layout (A → I):
 *   A: ticker           (string – user input)
 *   B: stock_name        (formula – GOOGLEFINANCE "name")
 *   C: current_price     (formula – GOOGLEFINANCE "price")
 *   D: low_52w           (formula – GOOGLEFINANCE "low52")
 *   E: high_52w          (formula – GOOGLEFINANCE "high52")
 *   F: industry_avg_pe   (formula – GOOGLEFINANCE "pe" as baseline; override per-industry)
 *   G: current_pe        (formula – GOOGLEFINANCE "pe")
 *   H: current_book_value (formula – price ÷ pricetobook via EPS heuristic)
 *   I: today_change_pct  (formula – GOOGLEFINANCE "changepct")
 *
 * Every formula uses INDIRECT("A"&ROW()) so it is row-agnostic and safe
 * for appended rows.
 */
export const STOCK_SHEET_MODEL: SheetModel = {
  sheetName: 'Watchlist',
  columns: [
    { name: 'ticker', type: 'string' },
    {
      name: 'stock_name',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "name"), "")',
    },
    {
      name: 'current_price',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "price"), "")',
    },
    {
      name: 'low_52w',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "low52"), "")',
    },
    {
      name: 'high_52w',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "high52"), "")',
    },
    {
      name: 'industry_avg_pe',
      type: 'formula',
      // GOOGLEFINANCE has no "industry PE" attribute; defaults to the
      // stock's own PE as a baseline — override per-industry in the sheet.
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "pe"), "")',
    },
    {
      name: 'current_pe',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "pe"), "")',
    },
    {
      name: 'current_book_value',
      type: 'formula',
      formula:
        '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "price")/GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "pe")*GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "eps"), "")',
    },
    {
      name: 'today_change_pct',
      type: 'formula',
      formula: '=IFERROR(GOOGLEFINANCE("NSE:"&INDIRECT("A"&ROW()), "changepct"), "")',
    },
  ],
};

export const STOCK_HEADER_ROW = {
  ticker: 'Ticker',
  stock_name: 'Stock Name',
  current_price: 'Current Price',
  low_52w: '52 Week Low',
  high_52w: '52 Week High',
  industry_avg_pe: 'Industry Avg PE',
  current_pe: 'Current PE',
  current_book_value: 'Book Value',
  today_change_pct: 'Today Change %',
} as unknown as Stock;

/** Header cells in column order for `ensureSheetHeaderRow` */
export function stockHeaderValues(): unknown[] {
  const labels = STOCK_HEADER_ROW as unknown as Record<string, unknown>;
  return STOCK_SHEET_MODEL.columns.map(c => labels[c.name] ?? '');
}
