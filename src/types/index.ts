/**
 * Core types and interfaces for all-sheet-db-js
 */

export * from './migration';

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
  /** Spreadsheet ID or common name */
  sheetName: string;
  /** Schema model */
  model?: SheetModel;
  /** Append rows instead of overwriting */
  append?: boolean;
}

export interface CacheOptions {
  /** Enable or disable caching for this request. Defaults to false. */
  enabled: boolean;
  /** 
   * Time to live in milliseconds. 
   * If not provided, defaults to 5 minutes (300,000 ms).
   */
  ttl?: number;
  /** 
   * Optional custom key for the cache. 
   * If not provided, a key will be generated based on spreadsheetId/sheetName and other options.
   */
  key?: string;
  /**
   * Force fetch from API even if cached data exists.
   */
  forceFetch?: boolean;
}

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: any;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SortOption {
  column: string;
  order: 'asc' | 'desc';
}

export interface RetrieveOptions {
  /** Spreadsheet ID or common name */
  sheetName: string;
  /** Schema model */
  model?: SheetModel;
  /** Range to read (e.g. "Sheet1!A1:Z100") */
  range?: string;
  /** Predicate filters to apply (exact match if object, advanced if array) */
  filters?: Record<string, unknown> | FilterCondition[];
  /** Pagination settings */
  pagination?: PaginationOptions;
  /** Sorting settings */
  sort?: SortOption[];
  /** Grouping settings */
  groupBy?: string | string[];
  /** Optional cache configuration */
  cache?: CacheOptions;
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
  /** Timestamp when the data was retrieved (from cache or API) */
  timestamp?: number;
  /** Indicates if the data was served from cache */
  fromCache?: boolean;
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
