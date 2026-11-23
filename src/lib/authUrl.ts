export interface ParsedAuthCallback {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
}

/**
 * Mengurai parameter OAuth callback Supabase baik dari query (?code=...)
 * maupun fragment (#access_token=...&refresh_token=...).
 */
export function parseAuthTokensFromUrl(url: string): ParsedAuthCallback {
  const empty: ParsedAuthCallback = {
    code: null,
    accessToken: null,
    refreshToken: null,
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
    accessToken: hashParams.get('access_token') ?? queryParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? queryParams.get('refresh_token'),
    error: queryParams.get('error') ?? hashParams.get('error'),
    errorDescription:
      queryParams.get('error_description') ?? hashParams.get('error_description'),
  };
}
