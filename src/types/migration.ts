/**
 * Migration related types
 */

export interface MigrationAction {
  type: 'add_column' | 'delete_column' | 'rename_column' | 'transform_data' | 'update_formula';
  column?: string;
  newColumn?: string;
  defaultValue?: unknown;
  formula?: string;
  /** Callback for data transformation */
  transform?: (row: any) => any;
}

export interface Migration {
  /** Sequential version number */
  version: number;
  /** Human readable description of the change */
  description: string;
  /** List of actions to perform */
  actions: MigrationAction[];
}

export interface MigrationOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Sheet tab name (e.g. "Expenses") */
  sheetName: string;
  /** List of migrations to apply */
  migrations: Migration[];
  /** Whether to backup before migration (not implemented yet, but good for API) */
  backup?: boolean;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  appliedMigrations: number;
  error?: string;
}
