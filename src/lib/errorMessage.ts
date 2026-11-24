/**
 * Mengubah pesan error teknis (PostgreSQL, Supabase, runtime JS) menjadi pesan
 * Bahasa Indonesia yang aman dan mudah dipahami kasir tanpa membocorkan detail internal.
 */
const INTERNAL_ERROR_PATTERNS = [
  /violates\s+/i,
  /duplicate\s+key/i,
  /permission\s+denied/i,
  /row-level\s+security/i,
  /relation\s+"[^"]+"/i,
  /column\s+"[^"]+"/i,
  /syntax\s+error/i,
  /invalid\s+input\s+syntax/i,
  /\bPGRST\d+\b/i,
  /\bJWT\b/i,
  /^(TypeError|ReferenceError|SyntaxError|RangeError):/i,
  /SQLSTATE/i,
];

const NETWORK_ERROR_PATTERNS = [
  /network\s+request\s+failed/i,
  /failed\s+to\s+fetch/i,
  /fetch\s+failed/i,
  /timeout/i,
  /timed\s+out/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
];

export function toUserFriendlyError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.trim() : typeof err === 'string' ? err.trim() : '';
  if (!raw) {
    return fallback;
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) {
    return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.';
  }

  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return raw;
}
