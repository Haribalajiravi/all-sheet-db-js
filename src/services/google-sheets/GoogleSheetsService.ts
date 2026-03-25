/**
 * Google Sheets Service Implementation
 *
 * Auth uses **Google Identity Services (GIS)** OAuth 2.0 token client — not deprecated `gapi.auth2`.
 * @see https://developers.google.com/identity/gsi/web/guides/gis-migration
 */

import { ISpreadsheetService } from '../../types/service.interface';
import {
  AuthCredentials,
  AuthToken,
  GoogleSpreadsheetSummary,
  StoreOptions,
  StoreResult,
  RetrieveOptions,
  RetrieveResult,
  DeleteOptions,
  DeleteResult,
  UpdateOptions,
  UpdateResult,
} from '../../types';
import { logger } from '../../utils/logger';
import {
  AuthenticationError,
  ServiceError,
  ValidationError,
  formatErrorMessage,
} from '../../utils/errors';
import { getCookie, isCookieAvailable } from '../../utils/cookie';

// ── Extracted utilities ──────────────────────────────────────────────────
import type { GapiClientNamespace, GisTokenResponse, GoogleSheetsConfig } from './gapi-types';
import {
  COOKIE_OAUTH_CLIENT_ID,
  GIS_SCRIPT,
  GAPI_SCRIPT,
  TOKEN_REFRESH_BUFFER_MS,
  DEFAULT_SCOPES,
  DEFAULT_DISCOVERY_DOCS,
} from './constants';
import { loadScript } from './script-loader';
import { saveAuthToken, getAuthToken, clearAuthTokens } from './token-store';
import { convertDataToRows, convertRowsToData } from './data-mapper';

// Re-export types so external consumers don't need a separate import
export type { GapiClientNamespace, GoogleSheetsConfig, GisTokenResponse } from './gapi-types';

export class GoogleSheetsService implements ISpreadsheetService {
  readonly name = 'google-sheets';
  private config: GoogleSheetsConfig = {};
  private gapi: GapiClientNamespace | null = null;
  private initialized = false;
  private gisLoadPromise: Promise<void> | null = null;
  private gapiClientLoadPromise: Promise<void> | null = null;

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Initialization                                                     │
  // ╰──────────────────────────────────────────────────────────────────────╯

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config as GoogleSheetsConfig;

    if (!isCookieAvailable()) {
      throw new ServiceError(
        'Cookies are not available. This library requires a browser environment.'
      );
    }

    await this.ensureGisLoaded();
    await this.ensureGapiClientInitialized();
    this.initialized = true;
    logger.info('Google Sheets service initialized (GIS + gapi client)');
  }

  private ensureGisLoaded(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new ServiceError('Window object is not available'));
    }
    if (window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }
    if (this.gisLoadPromise) {
      return this.gisLoadPromise;
    }
    this.gisLoadPromise = loadScript(GIS_SCRIPT).then(() => {
      if (!window.google?.accounts?.oauth2) {
        throw new ServiceError('Google Identity Services script did not expose oauth2');
      }
    });
    return this.gisLoadPromise;
  }

  private getMergedDiscoveryDocs(): string[] {
    const extra = this.config.discoveryDocs || [];
    return [...new Set([...DEFAULT_DISCOVERY_DOCS, ...extra])];
  }

  private getScopes(): string {
    const scopes = this.config.scopes;
    if (scopes && scopes.length > 0) {
      return scopes.join(' ');
    }
    return DEFAULT_SCOPES.join(' ');
  }

  private hasClientFullyLoaded(): boolean {
    const c = this.gapi?.client;
    return !!(c?.sheets?.spreadsheets?.values && c?.drive?.files);
  }

  private ensureGapiClientInitialized(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new ServiceError('Window object is not available'));
    }
    if (this.hasClientFullyLoaded()) {
      return Promise.resolve();
    }
    if (this.gapi && !this.hasClientFullyLoaded()) {
      this.gapiClientLoadPromise = null;
    }
    if (this.gapiClientLoadPromise) {
      return this.gapiClientLoadPromise;
    }
    this.gapiClientLoadPromise = new Promise((resolve, reject) => {
      const done = async () => {
        try {
          const gapi = window.gapi;
          if (!gapi) {
            reject(new ServiceError('gapi not available'));
            return;
          }
          this.gapi = gapi as unknown as GapiClientNamespace;
          await gapi.client.init({
            discoveryDocs: this.getMergedDiscoveryDocs(),
          });
          resolve();
        } catch (e) {
          reject(new ServiceError(`gapi client init failed: ${formatErrorMessage(e)}`));
        }
      };

      if (window.gapi?.load) {
        window.gapi.load('client', done);
        return;
      }

      loadScript(GAPI_SCRIPT)
        .then(() => {
          if (!window.gapi?.load) {
            reject(new ServiceError('gapi.load not available'));
            return;
          }
          window.gapi.load('client', done);
        })
        .catch(reject);
    });
    return this.gapiClientLoadPromise;
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Authentication                                                     │
  // ╰──────────────────────────────────────────────────────────────────────╯

  async authenticate(credentials: AuthCredentials): Promise<AuthToken> {
    if (!this.initialized || !this.gapi) {
      throw new ServiceError('Google API not loaded. Call initialize() first.');
    }
    if (!credentials.clientId) {
      throw new AuthenticationError('Client ID is required');
    }

    await this.ensureGisLoaded();

    const scope = this.getScopes();
    const gisPrompt =
      credentials.oauthPrompt === 'select_account'
        ? 'select_account'
        : credentials.oauthPrompt === 'consent'
          ? 'consent'
          : '';

    try {
      const token = await new Promise<AuthToken>((resolve, reject) => {
        const oauth2 = window.google!.accounts.oauth2;
        const tokenClient = oauth2.initTokenClient({
          client_id: credentials.clientId,
          scope,
          callback: (resp: GisTokenResponse) => {
            if (resp.error) {
              reject(
                new Error(
                  resp.error_description
                    ? `${resp.error}: ${resp.error_description}`
                    : String(resp.error)
                )
              );
              return;
            }
            if (!resp.access_token) {
              reject(new Error('No access token returned'));
              return;
            }
            const expiresIn = resp.expires_in ?? 3600;
            resolve({
              accessToken: resp.access_token,
              expiresAt: Date.now() + expiresIn * 1000,
              tokenType: resp.token_type ?? 'Bearer',
            });
          },
        });
        tokenClient.requestAccessToken({ prompt: gisPrompt });
      });

      this.gapi.client.setToken({ access_token: token.accessToken });
      saveAuthToken(token, credentials.clientId);
      logger.info('Google Sheets authentication successful (GIS)');
      return token;
    } catch (error) {
      logger.error('Google Sheets authentication failed:', error);
      const detail = formatErrorMessage(error);
      throw new AuthenticationError(
        detail.startsWith('Authentication') || detail.startsWith('Not authenticated')
          ? detail
          : `Authentication failed: ${detail}`
      );
    }
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.gapi) return false;
    const token = getAuthToken();
    if (!token || token.expiresAt <= Date.now()) return false;
    this.syncTokenToGapi();
    return true;
  }

  async refreshAuth(): Promise<AuthToken | null> {
    if (!this.gapi) return null;

    const clientId = getCookie(COOKIE_OAUTH_CLIENT_ID);
    if (!clientId) {
      logger.warn('Cannot refresh: OAuth client id not stored; sign in again');
      return null;
    }

    await this.ensureGisLoaded();
    const scope = this.getScopes();

    return new Promise(resolve => {
      const oauth2 = window.google!.accounts.oauth2;
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp: GisTokenResponse) => {
          if (resp.error || !resp.access_token) {
            logger.error('Token refresh failed:', resp);
            resolve(null);
            return;
          }
          const expiresIn = resp.expires_in ?? 3600;
          const token: AuthToken = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + expiresIn * 1000,
            tokenType: resp.token_type ?? 'Bearer',
          };
          this.gapi!.client.setToken({ access_token: token.accessToken });
          saveAuthToken(token, clientId);
          logger.info('Google Sheets token refreshed (GIS)');
          resolve(token);
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async clearAuth(): Promise<void> {
    const token = getAuthToken();

    if (token?.accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(token.accessToken, () => {
          logger.debug('Google token revoked successfully');
        });
      } catch (error) {
        logger.error('Failed to revoke Google token:', error);
      }
    } else if (token?.accessToken) {
      // Fallback manual revoke if GIS library is somehow not loaded completely
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
        logger.debug('Google token revoked via POST endpoint');
      } catch (error) {
        logger.error('Failed to manually revoke Google token:', error);
      }
    }

    if (this.gapi?.client?.setToken) {
      this.gapi.client.setToken(null);
    }
    clearAuthTokens();
    logger.info('Google Sheets authentication cleared');
  }

  private syncTokenToGapi(): void {
    const t = getAuthToken();
    if (this.gapi?.client && t && t.expiresAt > Date.now()) {
      this.gapi.client.setToken({ access_token: t.accessToken });
    }
  }

  /**
   * Keeps a valid access token on gapi without a popup when Google still has a session.
   * If that fails, callers must run interactive `authenticate()` again.
   */
  async ensureAccessToken(): Promise<void> {
    if (!this.gapi) {
      throw new ServiceError('Google API not loaded. Call initialize() first.');
    }

    const t = getAuthToken();
    const now = Date.now();

    if (t && t.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      this.syncTokenToGapi();
      return;
    }

    if (t && t.expiresAt > now) {
      if (await this.refreshAuth()) {
        this.syncTokenToGapi();
        return;
      }
    }

    if (!t || t.expiresAt <= now) {
      if (await this.refreshAuth()) {
        this.syncTokenToGapi();
        return;
      }
    }

    const again = getAuthToken();
    if (again && again.expiresAt > now) {
      this.syncTokenToGapi();
      return;
    }

    throw new AuthenticationError(
      'Your Google session expired. Please sign in again (the app will open the Google prompt).'
    );
  }

  /** Try to obtain a new access token without forcing consent UI. */
  async trySilentTokenRefresh(): Promise<boolean> {
    return !!(await this.refreshAuth());
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Spreadsheet management (Drive API)                                 │
  // ╰──────────────────────────────────────────────────────────────────────╯

  async listSpreadsheets(pageSize = 100): Promise<GoogleSpreadsheetSummary[]> {
    await this.ensureGapiClientInitialized();
    await this.ensureAccessToken();
    if (!this.gapi?.client?.drive?.files) {
      throw new ServiceError('Drive client not loaded. Check discovery docs include Drive v3.');
    }
    const res = await this.gapi.client.drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      pageSize,
      fields: 'files(id, name)',
      orderBy: 'modifiedTime desc',
    });
    const files = res.result.files ?? [];
    return files
      .filter(
        (f): f is { id: string; name: string } =>
          typeof f.id === 'string' && typeof f.name === 'string'
      )
      .map(f => ({ id: f.id, name: f.name }));
  }

  async createSpreadsheet(
    title: string,
    firstSheetTitle = 'Expenses'
  ): Promise<{ spreadsheetId: string }> {
    await this.ensureGapiClientInitialized();
    await this.ensureAccessToken();
    const res = await this.gapi!.client.sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [
          {
            properties: {
              title: firstSheetTitle,
              gridProperties: { rowCount: 2000, columnCount: 12 },
            },
          },
        ],
      },
    });
    const spreadsheetId = res.result.spreadsheetId;
    if (!spreadsheetId) throw new ServiceError('createSpreadsheet: missing spreadsheetId');
    return { spreadsheetId };
  }

  async deleteSpreadsheet(spreadsheetId: string): Promise<void> {
    await this.ensureGapiClientInitialized();
    await this.ensureAccessToken();
    if (!this.gapi?.client?.drive?.files) throw new ServiceError('Drive client not loaded.');
    await this.gapi.client.drive.files.delete({ fileId: spreadsheetId });
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Sheet header & schema migration                                    │
  // ╰──────────────────────────────────────────────────────────────────────╯

  /**
   * Ensure a tab exists and row 1 contains the expected header values.
   *
   * **Schema migration**: when the existing header differs from the new one
   * (columns added, removed, or reordered) the method reads all data rows,
   * remaps them to the new column order, clears the sheet, then writes the
   * updated header + migrated data back.
   */
  async ensureSheetHeaderRow(params: {
    spreadsheetId: string;
    sheetTabName: string;
    headerValues: unknown[];
  }): Promise<void> {
    const { spreadsheetId, sheetTabName, headerValues } = params;
    await this.ensureGapiClientInitialized();
    await this.ensureAccessToken();

    // 1. Ensure the tab itself exists
    const meta = await this.gapi!.client.sheets.spreadsheets.get({ spreadsheetId });
    const titles =
      meta.result.sheets?.map(s => s.properties?.title).filter((t): t is string => !!t) ?? [];

    if (!titles.includes(sheetTabName)) {
      await this.gapi!.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: sheetTabName } } }] },
      });
    }

    // 2. Read the current header row
    const top = `${sheetTabName}!A1:Z1`;
    const existing = await this.gapi!.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: top,
    });
    const oldHeader = existing.result.values?.[0] ?? [];
    const hasHeader = oldHeader.some(c => c !== undefined && c !== null && String(c).trim() !== '');

    // 3. No header yet → just write it
    if (!hasHeader) {
      await this.gapi!.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [headerValues] },
      });
      return;
    }

    // 4. Header matches → nothing to do
    const newHeader = headerValues.map(h => String(h ?? '').trim());
    const oldHeaderStr = oldHeader.map(h => String(h ?? '').trim());
    if (
      newHeader.length === oldHeaderStr.length &&
      newHeader.every((h, i) => h === oldHeaderStr[i])
    ) {
      return;
    }

    // 5. Header changed → migrate data
    logger.info(`Schema change detected in "${sheetTabName}": migrating columns`, {
      old: oldHeaderStr,
      new: newHeader,
    });

    const oldIndexByName = new Map<string, number>();
    oldHeaderStr.forEach((name, idx) => oldIndexByName.set(name, idx));
    const mapping = newHeader.map(name => oldIndexByName.get(name) ?? -1);

    const allRange = `${sheetTabName}!A:Z`;
    const allRes = await this.gapi!.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: allRange,
    });
    const dataRows = (allRes.result.values ?? []).slice(1);

    const migratedRows = dataRows.map(row =>
      mapping.map(oldIdx => (oldIdx >= 0 ? (row[oldIdx] ?? '') : ''))
    );

    await this.gapi!.client.sheets.spreadsheets.values.clear({ spreadsheetId, range: allRange });

    await this.gapi!.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headerValues, ...migratedRows] },
    });

    logger.info(
      `Migration complete: ${migratedRows.length} row(s) remapped to ${newHeader.length} columns`
    );
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Store / Retrieve                                                   │
  // ╰──────────────────────────────────────────────────────────────────────╯

  async store<T = unknown>(data: T[], options: StoreOptions): Promise<StoreResult> {
    if (!this.gapi) throw new ServiceError('Google API not loaded. Call initialize() first.');
    await this.ensureAccessToken();

    if (!data || data.length === 0) throw new ValidationError('Data array cannot be empty');
    if (!options.sheetName) throw new ValidationError('Sheet name is required');

    try {
      const spreadsheetId = options.sheetName;
      const range = options.model?.sheetName || 'Sheet1';
      const rows = convertDataToRows(data, options.model);

      if (options.append) {
        const response = await this.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: rows },
        });
        logger.info(`Data appended to ${spreadsheetId}/${range}`, { rowsAffected: rows.length });
        return { success: true, rowsAffected: response.result.updates?.updatedRows || rows.length };
      } else {
        const response = await this.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: { values: rows },
        });
        logger.info(`Data stored to ${spreadsheetId}/${range}`, { rowsAffected: rows.length });
        return { success: true, rowsAffected: response.result.updatedRows || rows.length };
      }
    } catch (error) {
      logger.error('Failed to store data:', error);
      return { success: false, error: formatErrorMessage(error) };
    }
  }

  async retrieve<T = unknown>(options: RetrieveOptions): Promise<RetrieveResult<T>> {
    if (!this.gapi) throw new ServiceError('Google API not loaded. Call initialize() first.');
    await this.ensureAccessToken();

    if (!options.sheetName) throw new ValidationError('Sheet name is required');

    try {
      const spreadsheetId = options.sheetName;
      const range = options.range || options.model?.sheetName || 'Sheet1';
      const response = await this.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const rows = response.result.values || [];
      const data = convertRowsToData<T>(rows, options.model);

      logger.info(`Data retrieved from ${spreadsheetId}/${range}`, { rows: data.length });
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to retrieve data:', error);
      return { success: false, error: formatErrorMessage(error) };
    }
  }

  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  Delete / Update                                                    │
  // ╰──────────────────────────────────────────────────────────────────────╯

  /**
   * Delete rows matching a predicate.
   *
   * Uses `batchUpdate` with `deleteDimension` to physically remove the
   * matching rows from the sheet. Rows are deleted in reverse order so
   * indices stay valid. Formulas in other rows are preserved.
   */
  async deleteRows<T = unknown>(options: DeleteOptions<T>): Promise<DeleteResult> {
    if (!this.gapi) throw new ServiceError('Google API not loaded. Call initialize() first.');
    await this.ensureAccessToken();

    if (!options.sheetName) throw new ValidationError('Sheet name is required');

    try {
      const spreadsheetId = options.sheetName;
      const tabName = options.model?.sheetName || 'Sheet1';
      const range = options.range || tabName;

      // 1. Get numeric sheetId from tab name
      const meta = await this.gapi.client.sheets.spreadsheets.get({ spreadsheetId });
      const sheetMeta = meta.result.sheets?.find(s => s.properties?.title === tabName);
      const sheetId = (sheetMeta?.properties as Record<string, unknown> | undefined)?.sheetId ?? 0;

      // 2. Read everything (header + data)
      const res = await this.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range });
      const allRows = res.result.values || [];
      if (allRows.length <= 1) {
        return { success: true, deletedCount: 0 };
      }

      const headerRow = allRows[0];
      const dataRows = allRows.slice(1);

      // 3. Convert to typed objects to run the predicate
      const typed = convertRowsToData<T>([headerRow, ...dataRows], options.model);

      // 4. Collect 0-indexed sheet row numbers that match
      //    (data row i → sheet row i+1 because header is row 0)
      const deleteSheetRows: number[] = [];
      typed.forEach((obj, i) => {
        if (options.where(obj)) {
          deleteSheetRows.push(i + 1); // +1 to skip header
        }
      });

      if (deleteSheetRows.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      // 5. Build deleteDimension requests in REVERSE order
      //    (highest index first so earlier indices stay valid)
      const requests = [...deleteSheetRows]
        .sort((a, b) => b - a)
        .map(rowIndex => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }));

      await this.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests },
      });

      logger.info(`Deleted ${deleteSheetRows.length} row(s) from ${spreadsheetId}/${tabName}`);
      return { success: true, deletedCount: deleteSheetRows.length };
    } catch (error) {
      logger.error('Failed to delete rows:', error);
      return { success: false, error: formatErrorMessage(error) };
    }
  }

  /**
   * Update rows matching a predicate.
   *
   * Reads all data, applies `set()` to matched rows, then writes the
   * modified rows back to the sheet.
   */
  async updateRows<T = unknown>(options: UpdateOptions<T>): Promise<UpdateResult> {
    if (!this.gapi) throw new ServiceError('Google API not loaded. Call initialize() first.');
    await this.ensureAccessToken();

    if (!options.sheetName) throw new ValidationError('Sheet name is required');

    try {
      const spreadsheetId = options.sheetName;
      const tabName = options.model?.sheetName || 'Sheet1';
      const range = options.range || tabName;

      // 1. Read everything
      const res = await this.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range });
      const allRows = res.result.values || [];
      if (allRows.length <= 1) {
        return { success: true, updatedCount: 0 };
      }

      const headerRow = allRows[0];
      const dataRows = allRows.slice(1);

      // 2. Convert to typed objects
      const typed = convertRowsToData<T>([headerRow, ...dataRows], options.model);

      // 3. Apply updates
      let updatedCount = 0;
      const updatedRaw = dataRows.map((rawRow, i) => {
        if (options.where(typed[i])) {
          updatedCount++;
          const updatedObj = options.set(typed[i]);
          return convertDataToRows([updatedObj], options.model)[0];
        }
        return rawRow;
      });

      if (updatedCount === 0) {
        return { success: true, updatedCount: 0 };
      }

      // 4. Write back
      await this.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A2`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: updatedRaw },
      });

      logger.info(`Updated ${updatedCount} row(s) in ${spreadsheetId}/${tabName}`);
      return { success: true, updatedCount };
    } catch (error) {
      logger.error('Failed to update rows:', error);
      return { success: false, error: formatErrorMessage(error) };
    }
  }
}
