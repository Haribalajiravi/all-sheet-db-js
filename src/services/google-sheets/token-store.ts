/**
 * Cookie-based persistence for Google OAuth tokens.
 *
 * Tokens are stored as individual cookies so they survive page reloads
 * and can be read back to restore the gapi client token silently.
 */

import type { AuthToken } from '../../types';
import { setCookie, getCookie, deleteCookie } from '../../utils/cookie';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_EXPIRES_AT,
  COOKIE_TOKEN_TYPE,
  COOKIE_OAUTH_CLIENT_ID,
} from './constants';

/** Persist an AuthToken + the OAuth client id to cookies. */
export function saveAuthToken(token: AuthToken, oauthClientId: string): void {
  const maxAge = Math.max(60, Math.floor((token.expiresAt - Date.now()) / 1000));

  setCookie(COOKIE_ACCESS_TOKEN, token.accessToken, {
    maxAge,
    secure: true,
    sameSite: 'lax',
  });

  if (token.refreshToken) {
    setCookie(COOKIE_REFRESH_TOKEN, token.refreshToken, {
      maxAge: 60 * 60 * 24 * 365,
      secure: true,
      sameSite: 'lax',
    });
  }

  setCookie(COOKIE_EXPIRES_AT, token.expiresAt.toString(), {
    maxAge,
    secure: true,
    sameSite: 'lax',
  });

  if (token.tokenType) {
    setCookie(COOKIE_TOKEN_TYPE, token.tokenType, {
      maxAge,
      secure: true,
      sameSite: 'lax',
    });
  }

  setCookie(COOKIE_OAUTH_CLIENT_ID, oauthClientId, {
    maxAge: 60 * 60 * 24 * 365,
    secure: true,
    sameSite: 'lax',
  });
}

/** Read back the AuthToken from cookies, or `null` when absent/expired. */
export function getAuthToken(): AuthToken | null {
  const accessToken = getCookie(COOKIE_ACCESS_TOKEN);
  const refreshToken = getCookie(COOKIE_REFRESH_TOKEN);
  const expiresAtStr = getCookie(COOKIE_EXPIRES_AT);
  const tokenType = getCookie(COOKIE_TOKEN_TYPE);

  if (!accessToken || !expiresAtStr) {
    return null;
  }

  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiresAt: parseInt(expiresAtStr, 10),
    tokenType: tokenType || undefined,
  };
}

/** Remove all auth-related cookies. */
export function clearAuthTokens(): void {
  deleteCookie(COOKIE_ACCESS_TOKEN);
  deleteCookie(COOKIE_REFRESH_TOKEN);
  deleteCookie(COOKIE_EXPIRES_AT);
  deleteCookie(COOKIE_TOKEN_TYPE);
  deleteCookie(COOKIE_OAUTH_CLIENT_ID);
}
