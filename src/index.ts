/**
 * all-sheet-db-js
 * Main entry point for the library
 */

import { ServiceManager } from './core/ServiceManager';
import { GoogleSheetsService } from './services/google-sheets/GoogleSheetsService';
import { logger, LogLevel } from './utils/logger';
import {
  IntegrationConfig,
  ServiceType,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
  AuthCredentials,
  AuthToken,
} from './types';
import { ServiceError } from './utils/errors';

// Export types
export type {
  IntegrationConfig,
  ServiceType,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
  AuthCredentials,
  AuthToken,
  SheetModel,
  ColumnDefinition,
  GoogleSpreadsheetSummary,
} from './types';

export { GoogleSheetsService } from './services/google-sheets/GoogleSheetsService';

// Export errors
export {
  AllSheetDbError,
  AuthenticationError,
  ConfigurationError,
  ServiceError,
  ValidationError,
  formatErrorMessage,
} from './utils/errors';

// Export logger
export { logger, LogLevel } from './utils/logger';

// Export auth dialog (React component)
export { AuthDialog } from './auth/AuthDialog';
export type { AuthDialogProps } from './auth/AuthDialog';

/**
 * Main AllSheetDB class
 */
export class AllSheetDB {
  private serviceManager: ServiceManager;

  constructor() {
    this.serviceManager = new ServiceManager();
    this.registerDefaultServices();
  }

  /**
   * Register default services
   */
  private registerDefaultServices(): void {
    this.serviceManager.registerService(new GoogleSheetsService());
  }

  /**
   * Initialize the library with integration configuration
   */
  async initialize(config: IntegrationConfig): Promise<void> {
    await this.serviceManager.initialize(config);
    logger.info('AllSheetDB initialized');
  }

  /**
   * Set the current active service
   */
  setService(serviceName: ServiceType): void {
    this.serviceManager.setCurrentService(serviceName);
  }

  /**
   * Get the current active service name
   */
  getCurrentService(): ServiceType | null {
    const service = this.serviceManager.getCurrentService();
    return service ? (service.name as ServiceType) : null;
  }

  /**
   * Authenticate with the current service
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthToken> {
    const service = this.serviceManager.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    return await service.authenticate(credentials);
  }

  /**
   * Check if the current service is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const service = this.serviceManager.getCurrentService();
    if (!service) {
      return false;
    }

    return await service.isAuthenticated();
  }

  /**
   * Refresh authentication token
   */
  async refreshAuth(): Promise<AuthToken | null> {
    const service = this.serviceManager.getCurrentService();
    if (!service) {
      return null;
    }

    return await service.refreshAuth();
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    const service = this.serviceManager.getCurrentService();
    if (!service) {
      return;
    }

    await service.clearAuth();
  }

  /**
   * Store data in the spreadsheet
   */
  async store<T = unknown>(data: T[], options: StoreOptions): Promise<StoreResult> {
    return await this.serviceManager.store(data, options);
  }

  /**
   * Retrieve data from the spreadsheet
   */
  async retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>> {
    return await this.serviceManager.retrieve<T>(options);
  }

  /**
   * Delete rows matching a predicate
   */
  async deleteRows<T = unknown>(options: DeleteOptions<T>): Promise<DeleteResult> {
    return await this.serviceManager.deleteRows<T>(options);
  }

  /**
   * Update rows matching a predicate
   */
  async updateRows<T = unknown>(options: UpdateOptions<T>): Promise<UpdateResult> {
    return await this.serviceManager.updateRows<T>(options);
  }

  /**
   * Get all available services
   */
  getAvailableServices(): ServiceType[] {
    return this.serviceManager.getRegisteredServices();
  }

  /**
   * Access Google Sheets–specific helpers (list/create/delete spreadsheets, silent refresh, etc.)
   * when the active service is `google-sheets`.
   */
  getGoogleSheetsService(): GoogleSheetsService | null {
    const s = this.serviceManager.getService('google-sheets');
    return s instanceof GoogleSheetsService ? s : null;
  }

  /**
   * Set logger level
   */
  setLogLevel(level: LogLevel): void {
    logger.setLevel(level);
  }
}

// Create and export a default instance
export const allSheetDB = new AllSheetDB();

// Default export
export default AllSheetDB;
