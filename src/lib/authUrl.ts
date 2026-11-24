export interface ParsedAuthCallback {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
}

/**
 * Memastikan URL callback OAuth benar-benar cocok dengan redirect URI aplikasi
 * (scheme + host/path) sebelum parameter code dibaca.
 */
export function isExpectedAuthCallback(url: string, expectedRedirectUri: string): boolean {
  if (!url || !expectedRedirectUri) {
    return false;
  }

  const normalizedUrl = url.split(/[?#]/)[0]?.toLowerCase() ?? '';
  const normalizedExpected = expectedRedirectUri.split(/[?#]/)[0]?.toLowerCase() ?? '';

  return normalizedExpected.length > 0 && normalizedUrl === normalizedExpected;
}

/**
 * Mengurai parameter OAuth callback Supabase khusus PKCE (?code=...) atau error.
 * Token implicit (#access_token / #refresh_token) sengaja tidak diterima untuk
 * mencegah kebocoran token mentah melalui custom URI scheme (RFC 8252 / F-03).
 */
export function parseAuthTokensFromUrl(url: string): ParsedAuthCallback {
  const empty: ParsedAuthCallback = {
    code: null,
    error: null,
    errorDescription: null,
  };

  if (!url) {
    return empty;
  }

  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  const queryString =
    queryIndex !== -1
      ? url.slice(queryIndex + 1, hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : undefined)
      : '';
  const hashString = hashIndex !== -1 ? url.slice(hashIndex + 1) : '';

  const queryParams = new URLSearchParams(queryString);
  const hashParams = new URLSearchParams(hashString);

  return {
    code: queryParams.get('code') ?? hashParams.get('code'),
    error: queryParams.get('error') ?? hashParams.get('error'),
    errorDescription:
      queryParams.get('error_description') ?? hashParams.get('error_description'),
  };
}
