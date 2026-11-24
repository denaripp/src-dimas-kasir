import { describe, expect, test } from 'bun:test';
import { matchBarcode, normalizeBarcode } from '../barcode';

describe('barcode utils', () => {
  test('normalizeBarcode membersihkan karakter kontrol, BOM, newlines, dan spasi', () => {
    expect(normalizeBarcode('  ABC-123\r\n\t ')).toBe('ABC-123');
    expect(normalizeBarcode('\uFEFF8999999123456\u200B')).toBe('8999999123456');
    expect(normalizeBarcode(null)).toBe('');
    expect(normalizeBarcode(undefined)).toBe('');
  });

  test('matchBarcode mencocokkan string identik secara case-insensitive', () => {
    expect(matchBarcode('Indomie-Goreng-01', 'indomie-goreng-01')).toBe(true);
    expect(matchBarcode('  QR-CODE-123\n', 'qr-code-123 ')).toBe(true);
    expect(matchBarcode('ABC', 'XYZ')).toBe(false);
  });

  test('matchBarcode mendukung toleransi konversi UPC-A (12 digit) dan EAN-13 (13 digit dengan leading zero)', () => {
    // Database menyimpan EAN-13 (13 digit dengan 0 di depan), scanner membaca UPC-A (12 digit)
    expect(matchBarcode('0899999123456', '899999123456')).toBe(true);
    // Database menyimpan UPC-A (12 digit), scanner membaca EAN-13 (13 digit dengan 0 di depan)
    expect(matchBarcode('899999123456', '0899999123456')).toBe(true);
    // Jika digit tidak cocok
    expect(matchBarcode('0899999123456', '899999123457')).toBe(false);
  });

  test('matchBarcode mendukung toleransi URL percent-encoding', () => {
    expect(
      matchBarcode(
        'https://toko.src.id/p/indomie%20goreng',
        'https://toko.src.id/p/indomie goreng',
      ),
    ).toBe(true);
  });

  test('matchBarcode menolak barcode kosong atau null', () => {
    expect(matchBarcode('', '123')).toBe(false);
    expect(matchBarcode(null, '123')).toBe(false);
    expect(matchBarcode('123', '')).toBe(false);
    expect(matchBarcode(null, null)).toBe(false);
  });
});
