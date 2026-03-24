/**
 * Service Manager - Manages all spreadsheet service modules
 */

import { ISpreadsheetService } from '../types/service.interface';
import {
  ServiceType,
  IntegrationConfig,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
} from '../types';
import { logger } from '../utils/logger';
import { ConfigurationError, ServiceError } from '../utils/errors';

export class ServiceManager {
  private services: Map<ServiceType, ISpreadsheetService> = new Map();
  private currentService: ServiceType | null = null;
  private config: IntegrationConfig | null = null;

  /**
   * Register a service module
   */
  registerService(service: ISpreadsheetService): void {
    this.services.set(service.name as ServiceType, service);
    logger.info(`Service registered: ${service.name}`);
  }

  /**
   * Set the current active service
   */
  setCurrentService(serviceName: ServiceType): void {
    if (!this.services.has(serviceName)) {
      throw new ServiceError(`Service ${serviceName} is not registered`, serviceName);
    }
    this.currentService = serviceName;
    logger.info(`Current service set to: ${serviceName}`);
  }

  /**
   * If nothing is selected, pick a sensible default:
   * - first enabled service from integration config (after initialize), or
   * - the only registered service (e.g. google-sheets) so store/retrieve work after refresh
   */
  private ensureDefaultServiceSelection(): void {
    if (this.currentService && this.services.has(this.currentService)) {
      return;
    }

    if (this.config) {
      for (const sc of this.config.services) {
        if (!sc.enabled) continue;
        if (this.services.has(sc.name)) {
          this.currentService = sc.name;
          logger.info(`Active service auto-selected: ${sc.name} (from integration config)`);
          return;
        }
      }
    }

    if (this.services.size === 1) {
      const only = this.services.keys().next().value as ServiceType;
      this.currentService = only;
      logger.info(`Active service auto-selected: ${only} (single registered service)`);
    }
  }

  /**
   * Get the current active service
   */
  getCurrentService(): ISpreadsheetService | null {
    this.ensureDefaultServiceSelection();
    if (!this.currentService) {
      return null;
    }
    return this.services.get(this.currentService) || null;
  }

  /**
   * Initialize services with configuration
   */
  async initialize(config: IntegrationConfig): Promise<void> {
    this.config = config;

    for (const serviceConfig of config.services) {
      if (!serviceConfig.enabled) {
        logger.debug(`Service ${serviceConfig.name} is disabled, skipping`);
        continue;
      }

      const service = this.services.get(serviceConfig.name);
      if (!service) {
        logger.warn(`Service ${serviceConfig.name} is not registered`);
        continue;
      }

      try {
        await service.initialize(serviceConfig.credentials || {});
        logger.info(`Service ${serviceConfig.name} initialized`);
      } catch (error) {
        logger.error(`Failed to initialize service ${serviceConfig.name}:`, error);
        throw new ConfigurationError(`Failed to initialize service ${serviceConfig.name}`);
      }
    }

    this.ensureDefaultServiceSelection();
  }

  /**
   * Store data using the current service
   */
  async store<T = unknown>(data: T[], options: StoreOptions): Promise<StoreResult> {
    const service = this.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    try {
      logger.debug(`Storing data to ${this.currentService}`, {
        sheetName: options.sheetName,
        rows: data.length,
      });
      return await service.store(data, options);
    } catch (error) {
      logger.error(`Failed to store data:`, error);
      throw new ServiceError(
        `Failed to store data: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }

  /**
   * Retrieve data using the current service
   */
  async retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>> {
    const service = this.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    try {
      logger.debug(`Retrieving data from ${this.currentService}`, { sheetName: options.sheetName });
      return await service.retrieve<T>(options);
    } catch (error) {
      logger.error(`Failed to retrieve data:`, error);
      throw new ServiceError(
        `Failed to retrieve data: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }

  /**
   * Get all registered services
   */
  getRegisteredServices(): ServiceType[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service by name
   */
  getService(serviceName: ServiceType): ISpreadsheetService | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Delete rows matching a predicate
   */
  async deleteRows<T = unknown>(options: DeleteOptions<T>): Promise<DeleteResult> {
    const service = this.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    try {
      logger.debug(`Deleting rows from ${this.currentService}`, { sheetName: options.sheetName });
      return await service.deleteRows(options);
    } catch (error) {
      logger.error(`Failed to delete rows:`, error);
      throw new ServiceError(
        `Failed to delete rows: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }

  /**
   * Update rows matching a predicate
   */
  async updateRows<T = unknown>(options: UpdateOptions<T>): Promise<UpdateResult> {
    const service = this.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    try {
      logger.debug(`Updating rows in ${this.currentService}`, { sheetName: options.sheetName });
      return await service.updateRows(options);
    } catch (error) {
      logger.error(`Failed to update rows:`, error);
      throw new ServiceError(
        `Failed to update rows: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }
}
