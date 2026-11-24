import { describe, expect, test } from 'bun:test';
import { isExpectedAuthCallback, parseAuthTokensFromUrl } from '../authUrl';

describe('parseAuthTokensFromUrl (PKCE-only)', () => {
  test('mengurai PKCE authorization code dari query string', () => {
    const res = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback?code=pkce_code_123',
    );
    expect(res.code).toBe('pkce_code_123');
    expect(res.error).toBe(null);
  });

  test('menolak implicit access_token/refresh_token dari hash fragment (F-03)', () => {
    const res = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback#access_token=acc_999&refresh_token=ref_888&token_type=bearer',
    );
    expect(res.code).toBe(null);
    expect(res.error).toBe(null);
    expect('accessToken' in res).toBe(false);
    expect('refreshToken' in res).toBe(false);
  });

  test('mengurai error OAuth dan menangani URL kosong', () => {
    const errRes = parseAuthTokensFromUrl(
      'srcdimaskasir://auth/callback?error=access_denied&error_description=User+cancelled',
    );
    expect(errRes.error).toBe('access_denied');
    expect(errRes.errorDescription).toBe('User cancelled');

    const emptyRes = parseAuthTokensFromUrl('');
    expect(emptyRes.code).toBe(null);
    expect(emptyRes.error).toBe(null);
  });
});

describe('isExpectedAuthCallback', () => {
  test('memvalidasi prefix scheme & path redirect URI secara ketat', () => {
    expect(
      isExpectedAuthCallback(
        'srcdimaskasir://auth/callback?code=abc',
        'srcdimaskasir://auth/callback',
      ),
    ).toBe(true);
    expect(
      isExpectedAuthCallback(
        'evilscheme://auth/callback?code=abc',
        'srcdimaskasir://auth/callback',
      ),
    ).toBe(false);
    expect(
      isExpectedAuthCallback(
        'srcdimaskasir://other/path?code=abc',
        'srcdimaskasir://auth/callback',
      ),
    ).toBe(false);
  });
});
