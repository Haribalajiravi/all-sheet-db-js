/** Cookie key constants for token persistence */
export const COOKIE_ACCESS_TOKEN = 'google_sheets_access_token';
export const COOKIE_EXPIRES_AT = 'google_sheets_expires_at';
export const COOKIE_TOKEN_TYPE = 'google_sheets_token_type';
/** Public OAuth client id — stored so silent refresh can run after page reload */
export const COOKIE_OAUTH_CLIENT_ID = 'google_sheets_oauth_client_id';

/** Google Identity Services script URL */
export const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
/** Google API client library script URL */
export const GAPI_SCRIPT = 'https://apis.google.com/js/api.js';

/** Proactively refresh the access token this long before it expires (silent when Google allows). */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

export const DEFAULT_DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
];
