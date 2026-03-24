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
import type {
  IntegrationConfig,
  ServiceType,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  AuthCredentials,
  AuthToken,
} from './types';
import { ServiceError } from './utils/errors';

export type {
  IntegrationConfig,
  ServiceType,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
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

  setLogLevel(level: LogLevel): void {
    logger.setLevel(level);
  }
}

export const allSheetDB = new AllSheetDB();
