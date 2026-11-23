import { describe, expect, test } from 'bun:test';
import { parseAuthTokensFromUrl } from '../authUrl';

describe('parseAuthTokensFromUrl', () => {
  test('mengurai PKCE authorization code dari query string', () => {
    const res = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback?code=pkce_code_123',
    );
    expect(res.code).toBe('pkce_code_123');
    expect(res.accessToken).toBe(null);
    expect(res.error).toBe(null);
  });

  test('mengurai access_token dan refresh_token dari hash fragment', () => {
    const res = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback#access_token=acc_999&refresh_token=ref_888&token_type=bearer',
    );
    expect(res.accessToken).toBe('acc_999');
    expect(res.refreshToken).toBe('ref_888');
    expect(res.code).toBe(null);
  });

  test('mengurai error OAuth dan menangani URL kosong', () => {
    const errRes = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback?error=access_denied&error_description=User+cancelled',
    );
    expect(errRes.error).toBe('access_denied');
    expect(errRes.errorDescription).toBe('User cancelled');

    const emptyRes = parseAuthTokensFromUrl('');
    expect(emptyRes.code).toBe(null);
    expect(emptyRes.accessToken).toBe(null);
  });
});
