/**
 * Minimal gapi typing for Sheets v4 + Drive v3 + setToken (no auth2).
 *
 * Kept in its own file so both the service class and utility modules can
 * reference the same shape without circular imports.
 */

export interface GapiClientNamespace {
  client: {
    init: (config: { discoveryDocs?: string[] }) => Promise<void>;
    setToken: (token: { access_token?: string } | null) => void;
    drive: {
      files: {
        list: (params: {
          q?: string;
          pageSize?: number;
          fields?: string;
          orderBy?: string;
        }) => Promise<{
          result: { files?: Array<{ id?: string; name?: string }> };
        }>;
        delete: (params: { fileId: string }) => Promise<void>;
      };
    };
    sheets: {
      spreadsheets: {
        get: (params: { spreadsheetId: string }) => Promise<{
          result: {
            sheets?: Array<{ properties?: { title?: string } }>;
          };
        }>;
        create: (params: {
          resource: {
            properties?: { title?: string };
            sheets?: Array<{
              properties?: {
                title?: string;
                gridProperties?: { rowCount?: number; columnCount?: number };
              };
            }>;
          };
        }) => Promise<{ result: { spreadsheetId?: string } }>;
        batchUpdate: (params: {
          spreadsheetId: string;
          resource: { requests?: unknown[] };
        }) => Promise<unknown>;
        values: {
          get: (params: { spreadsheetId: string; range: string }) => Promise<{
            result: { values?: unknown[][] };
          }>;
          update: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            resource: { values: unknown[][] };
          }) => Promise<{
            result: { updatedRows?: number };
          }>;
          append: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            insertDataOption: string;
            resource: { values: unknown[][] };
          }) => Promise<{
            result: { updates?: { updatedRows?: number } };
          }>;
          clear: (params: { spreadsheetId: string; range: string }) => Promise<unknown>;
        };
      };
    };
  };
  load: (api: string, callback: () => void) => void;
}

export interface GoogleSheetsConfig {
  apiKey?: string;
  discoveryDocs?: string[];
  scopes?: string[];
}

/** GIS token callback payload */
export interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GisTokenResponse) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke: (accessToken: string, callback: () => void) => void;
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
      client: GapiClientNamespace['client'];
    };
  }
}

// Ensure this file is treated as a module by TypeScript
export {};
