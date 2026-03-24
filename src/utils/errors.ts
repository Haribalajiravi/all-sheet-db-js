/**
 * Custom error classes for the library
 */

export class AllSheetDbError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AllSheetDbError';
    Object.setPrototypeOf(this, AllSheetDbError.prototype);
  }
}

export class AuthenticationError extends AllSheetDbError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class ConfigurationError extends AllSheetDbError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class ServiceError extends AllSheetDbError {
  constructor(
    message: string,
    public readonly serviceName?: string
  ) {
    super(message, 'SERVICE_ERROR');
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export class ValidationError extends AllSheetDbError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Google client libraries and OAuth often reject with a plain object, not an Error.
 * Using String(error) yields "[object Object]"; this extracts a readable message.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error === null || error === undefined) {
    return String(error);
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>;

    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message;
    }
    // Google Sign-In / gapi common shapes
    if (typeof o.error === 'string' && o.error.trim()) {
      const details = typeof o.details === 'string' ? `: ${o.details}` : '';
      return `${o.error}${details}`;
    }
    if (typeof o.details === 'string' && o.details.trim()) {
      return o.details;
    }
    if (typeof o.reason === 'string' && o.reason.trim()) {
      return o.reason;
    }

    // gapi client: { result: { error: { message, status } } }
    const result = o.result;
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      const inner = r.error;
      if (inner && typeof inner === 'object') {
        const e = inner as Record<string, unknown>;
        const msg = typeof e.message === 'string' ? e.message : '';
        const status = typeof e.status === 'string' ? e.status : '';
        if (msg || status) {
          return [status, msg].filter(Boolean).join(' — ');
        }
      }
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  return String(error);
}
