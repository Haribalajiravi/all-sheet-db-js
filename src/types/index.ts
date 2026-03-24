/**
 * Core types and interfaces for all-sheet-db-js
 */

export type ServiceType = 'google-sheets' | 'microsoft-excel';

export interface IntegrationConfig {
  services: ServiceConfig[];
}

export interface ServiceConfig {
  name: ServiceType;
  enabled: boolean;
  credentials?: Record<string, unknown>;
}

export interface AuthCredentials {
  clientId: string;
  clientSecret?: string;
  /**
   * Google Identity Services `requestAccessToken` prompt.
   * - `consent` (default): show consent when needed — typical first sign-in.
   * - `select_account`: account picker.
   * - `''`: no extra UI if Google can return a token silently (often works while the user is still logged into Google).
   */
  oauthPrompt?: 'consent' | 'select_account' | '';
  [key: string]: unknown;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType?: string;
}

/** File entry returned when listing Google spreadsheets via Drive API */
export interface GoogleSpreadsheetSummary {
  id: string;
  name: string;
}

export interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'formula';
  format?: string;
  formula?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface SheetModel {
  sheetName: string;
  columns: ColumnDefinition[];
}

export interface StoreOptions {
  sheetName: string;
  model?: SheetModel;
  append?: boolean;
}

export interface RetrieveOptions {
  sheetName: string;
  model?: SheetModel;
  range?: string;
  filters?: Record<string, unknown>;
}

export interface StoreResult {
  success: boolean;
  rowsAffected?: number;
  error?: string;
}

export interface RetrieveResult<T = unknown> {
  success: boolean;
  data?: T[];
  error?: string;
}

/**
 * Options for deleting rows from a spreadsheet.
 *
 * Rows are matched by a `where` predicate that receives each typed row.
 * All matching rows are removed.
 */
export interface DeleteOptions<T = unknown> {
  /** Spreadsheet ID */
  sheetName: string;
  /** Model used to read back rows for matching */
  model?: SheetModel;
  /** Range to scan (defaults to model.sheetName or 'Sheet1') */
  range?: string;
  /** Predicate — rows for which this returns `true` will be deleted */
  where: (row: T) => boolean;
}

export interface DeleteResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

/**
 * Options for updating rows in a spreadsheet.
 *
 * Rows are matched by a `where` predicate. Matched rows are passed
 * through `set` to produce the new values.
 */
export interface UpdateOptions<T = unknown> {
  /** Spreadsheet ID */
  sheetName: string;
  /** Model used to read/write rows */
  model?: SheetModel;
  /** Range to scan (defaults to model.sheetName or 'Sheet1') */
  range?: string;
  /** Predicate — rows for which this returns `true` will be updated */
  where: (row: T) => boolean;
  /** Produce the updated row from the original */
  set: (row: T) => T;
}

export interface UpdateResult {
  success: boolean;
  updatedCount?: number;
  error?: string;
}
