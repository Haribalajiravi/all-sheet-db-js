/**
 * Browser-friendly entry point for examples/demos.
 *
 * This intentionally avoids importing the optional React UI exports (`AuthDialog`)
 * so that non-React consumers (and the vanilla Vite demo) don't need React installed.
 */

import { ServiceManager } from './core/ServiceManager';
import { GoogleSheetsService } from './services/google-sheets/GoogleSheetsService';

export { GoogleSheetsService } from './services/google-sheets/GoogleSheetsService';
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
  MigrationOptions,
  MigrationResult,
  AuthCredentials,
  AuthToken,
} from './types';
import { ServiceError } from './utils/errors';
import { cacheManager } from './core/CacheManager';

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
  MigrationOptions,
  MigrationResult,
  AuthCredentials,
  AuthToken,
  SheetModel,
  ColumnDefinition,
} from './types';

export { logger, LogLevel } from './utils/logger';
export {
  AllSheetDbError,
  AuthenticationError,
  ConfigurationError,
  ServiceError,
  ValidationError,
  formatErrorMessage,
} from './utils/errors';

export class AllSheetDB {
  private serviceManager: ServiceManager;

  constructor() {
    this.serviceManager = new ServiceManager();
    this.serviceManager.registerService(new GoogleSheetsService());
  }

  async initialize(config: IntegrationConfig): Promise<void> {
    await this.serviceManager.initialize(config);
    logger.info('AllSheetDB initialized');
  }

  setService(serviceName: ServiceType): void {
    this.serviceManager.setCurrentService(serviceName);
  }

  getCurrentService(): ServiceType | null {
    const service = this.serviceManager.getCurrentService();
    return service ? (service.name as ServiceType) : null;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthToken> {
    const service = this.serviceManager.getCurrentService();
    if (!service) throw new ServiceError('No active service selected');
    return await service.authenticate(credentials);
  }

  async isAuthenticated(): Promise<boolean> {
    const service = this.serviceManager.getCurrentService();
    if (!service) return false;
    return await service.isAuthenticated();
  }

  async refreshAuth(): Promise<AuthToken | null> {
    const service = this.serviceManager.getCurrentService();
    if (!service) return null;
    return await service.refreshAuth();
  }

  getGoogleSheetsService(): GoogleSheetsService | null {
    const s = this.serviceManager.getService('google-sheets');
    return s instanceof GoogleSheetsService ? s : null;
  }

  async clearAuth(): Promise<void> {
    const service = this.serviceManager.getCurrentService();
    if (!service) return;
    await service.clearAuth();
  }

  async store<T = unknown>(data: T[], options: StoreOptions): Promise<StoreResult> {
    return await this.serviceManager.store(data, options);
  }

  async retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>> {
    return await this.serviceManager.retrieve<T>(options);
  }

  async deleteRows<T = unknown>(options: DeleteOptions<T>): Promise<DeleteResult> {
    return await this.serviceManager.deleteRows<T>(options);
  }

  async updateRows<T = unknown>(options: UpdateOptions<T>): Promise<UpdateResult> {
    return await this.serviceManager.updateRows<T>(options);
  }

  async migrate(options: MigrationOptions): Promise<MigrationResult> {
    return await this.serviceManager.migrate(options);
  }

  async clearCache(): Promise<void> {
    await cacheManager.clear();
  }

  async invalidateCache(sheetName: string): Promise<void> {
    const service = this.getCurrentService();
    if (service) {
      await cacheManager.invalidateByPrefix(`${service}:${sheetName}`);
    }
  }

  async getCacheStats(): Promise<{ size: number; keys: string[] }> {
    return await cacheManager.getStats();
  }

  setLogLevel(level: LogLevel): void {
    logger.setLevel(level);
  }
}

export const allSheetDB = new AllSheetDB();
