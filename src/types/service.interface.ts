/**
 * Service interface that all spreadsheet service modules must implement
 */

import {
  AuthCredentials,
  AuthToken,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
} from './index';

export interface ISpreadsheetService {
  /**
   * Service name identifier
   */
  readonly name: string;

  /**
   * Initialize the service with configuration
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Authenticate with the service
   */
  authenticate(credentials: AuthCredentials): Promise<AuthToken>;

  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Refresh authentication token if needed
   */
  refreshAuth(): Promise<AuthToken | null>;

  /**
   * Store data in the spreadsheet
   */
  store<T = unknown>(data: T[], options: StoreOptions): Promise<StoreResult>;

  /**
   * Retrieve data from the spreadsheet
   */
  retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>>;

  /**
   * Delete rows matching a predicate
   */
  deleteRows<T = unknown>(options: DeleteOptions<T>): Promise<DeleteResult>;

  /**
   * Update rows matching a predicate
   */
  updateRows<T = unknown>(options: UpdateOptions<T>): Promise<UpdateResult>;

  /**
   * Clear authentication
   */
  clearAuth(): Promise<void>;
}
