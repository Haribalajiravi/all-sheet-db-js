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
  MigrationOptions,
  MigrationResult,
  FilterCondition,
  SortOption,
  PopulateOptions,
} from '../types';
import { logger } from '../utils/logger';
import { ConfigurationError, ServiceError } from '../utils/errors';
import { cacheManager } from './CacheManager';

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

      const result = await service.store(data, options);
      if (result.success && this.currentService) {
        // Invalidate cache for this spreadsheet/sheet combination
        await cacheManager.invalidateByPrefix(`${this.currentService}:${options.sheetName}`);
      }
      return result;
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

      const serviceName = service.name as string;
      const cacheKey =
        options.cache?.key ||
        cacheManager.generateKey(serviceName, options.sheetName, options as any);

      // Check cache if enabled and no force fetch
      if (options.cache?.enabled && !options.cache?.forceFetch) {
        const ttl = options.cache.ttl || 300000;
        const cachedData = await cacheManager.get<T[]>(cacheKey, ttl);
        if (cachedData !== null) {
          logger.info(`Cache hit for ${cacheKey}`);
          return {
            success: true,
            data: cachedData,
            fromCache: true,
            timestamp: (await cacheManager.getTimestamp(cacheKey)) || undefined,
          };
        }
      }

      // Fetch fresh data
      const result = await service.retrieve<T>(options);

      // Apply filtering, sorting, grouping, pagination AFTER fetching
      // we do this in memory for consistent behavior across services
      if (result.success && result.data) {
        let processedData = [...result.data];

        // Advanced Filtering
        if (options.filters) {
          processedData = this.applyFilters(processedData, options.filters);
        }

        // Population (Joins)
        if (options.populate && options.populate.length > 0) {
          processedData = await this.applyPopulation(processedData, options.populate, options);
        }

        // Sorting
        if (options.sort && options.sort.length > 0) {
          processedData = this.applySorting(processedData, options.sort);
        }

        // Grouping
        if (options.groupBy) {
          result.data = this.applyGrouping(processedData, options.groupBy) as any;
        } else {
          // Pagination (only if not grouped)
          if (options.pagination) {
            const { offset = 0, limit } = options.pagination;
            processedData = processedData.slice(offset, limit ? offset + limit : undefined);
          }
          result.data = processedData;
        }
      }

      // Save to cache if enabled
      if (result.success && result.data && options.cache?.enabled && this.currentService) {
        await cacheManager.set(cacheKey, result.data);
      }

      return {
        ...result,
        timestamp: Date.now(),
        fromCache: false,
      };
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
      const result = await service.deleteRows(options);
      if (result.success && this.currentService) {
        // Invalidate cache for this sheet
        await cacheManager.invalidateByPrefix(`${this.currentService}:${options.sheetName}`);
      }
      return result;
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
      const result = await service.updateRows(options);
      if (result.success && this.currentService) {
        // Invalidate cache for this sheet
        await cacheManager.invalidateByPrefix(`${this.currentService}:${options.sheetName}`);
      }
      return result;
    } catch (error) {
      logger.error(`Failed to update rows:`, error);
      throw new ServiceError(
        `Failed to update rows: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }

  /**
   * Run data migrations
   */
  async migrate(options: MigrationOptions): Promise<MigrationResult> {
    const service = this.getCurrentService();
    if (!service) {
      throw new ServiceError('No active service selected');
    }

    try {
      logger.info(`Running migrations for ${this.currentService}/${options.sheetName}`);
      const result = await service.migrate(options);
      if (result.success && this.currentService) {
        // Invalidate cache since schema/data changed
        await cacheManager.invalidateByPrefix(`${this.currentService}:${options.sheetName}`);
      }
      return result;
    } catch (error) {
      logger.error(`Migration failed:`, error);
      throw new ServiceError(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        this.currentService || undefined
      );
    }
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Data Manipulation Helpers                                          │
  // ╰──────────────────────────────────────────────────────────────────────╯

  private applyFilters(data: any[], filters: Record<string, unknown> | FilterCondition[]): any[] {
    if (Array.isArray(filters)) {
      return data.filter(row => {
        return filters.every(cond => {
          const val = row[cond.column];
          switch (cond.operator) {
            case 'eq':
              return val === cond.value;
            case 'neq':
              return val !== cond.value;
            case 'gt':
              return val > cond.value;
            case 'gte':
              return val >= cond.value;
            case 'lt':
              return val < cond.value;
            case 'lte':
              return val <= cond.value;
            case 'contains':
              return String(val).toLowerCase().includes(String(cond.value).toLowerCase());
            case 'in':
              return Array.isArray(cond.value) && cond.value.includes(val);
            default:
              return true;
          }
        });
      });
    } else {
      // Basic exact match for object-style filters
      return data.filter(row => {
        return Object.entries(filters).every(([key, value]) => row[key] === value);
      });
    }
  }

  private applySorting(data: any[], sort: SortOption[]): any[] {
    return [...data].sort((a, b) => {
      for (const opt of sort) {
        const valA = a[opt.column];
        const valB = b[opt.column];
        if (valA === valB) continue;
        const multiplier = opt.order === 'desc' ? -1 : 1;
        return valA < valB ? -1 * multiplier : 1 * multiplier;
      }
      return 0;
    });
  }

  private applyGrouping(data: any[], groupBy: string | string[]): any {
    const keys = Array.isArray(groupBy) ? groupBy : [groupBy];

    const group = (items: any[], depth: number): any => {
      if (depth >= keys.length) return items;
      const key = keys[depth];
      const result: Record<string, any> = {};

      items.forEach(item => {
        const value = String(item[key]);
        if (!result[value]) result[value] = [];
        result[value].push(item);
      });

      // Recurse
      for (const [v, groupedItems] of Object.entries(result)) {
        result[v] = group(groupedItems, depth + 1);
      }
      return result;
    };

    return group(data, 0);
  }

  private async applyPopulation(
    data: any[],
    populate: PopulateOptions[],
    originalOptions: RetrieveOptions,
  ): Promise<any[]> {
    const resultData = [...data];

    for (const pop of populate) {
      const { from, localField, foreignField, as, fromSheetName } = pop;
      const targetField = as || localField;

      try {
        // Fetch data from the related sheet
        // We use this.retrieve to benefit from caching and consistent processing
        const relatedResult = await this.retrieve({
          // If a spreadsheet ID is specified, use it.
          // Otherwise, reuse the parent spreadsheet's ID (essential for Google Sheets tabs)
          sheetName: fromSheetName || originalOptions.sheetName,
          // 'from' represents the tab name in the target spreadsheet
          range: from,
          // Use default cache settings for population to improve performance
          cache: { enabled: true, ttl: 300000 },
        });

        if (relatedResult.success && relatedResult.data) {
          const relatedData = relatedResult.data;

          // Create a map for faster lookups (O(1) instead of O(N^2))
          const relatedMap = new Map();
          relatedData.forEach((item: any) => {
            const key = item[foreignField];
            if (key !== undefined && key !== null) {
              relatedMap.set(String(key), item);
            }
          });

          // Attach related data to each row
          resultData.forEach(row => {
            const lookupValue = row[localField];
            if (lookupValue !== undefined && lookupValue !== null) {
              row[targetField] = relatedMap.get(String(lookupValue)) || null;
            } else {
              row[targetField] = null;
            }
          });
        }
      } catch (error) {
        logger.error(`Population failed for sheet "${from}":`, error);
        // Continue with other populations even if one fails
      }
    }

    return resultData;
  }
}
