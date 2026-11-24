import { describe, expect, test } from 'bun:test';
import { BarcodeScanConsensus, matchBarcode, normalizeBarcode } from '../barcode';

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

describe('BarcodeScanConsensus', () => {
  test('menolak 1 frame buram/ngawur dan hanya meloloskan EAN-13 setelah 3 frame identik', () => {
    const filter = new BarcodeScanConsensus();

    // 1 frame ngawur tunggal (seperti 5996946660000 saat plastik memantul) harus ditolak
    expect(filter.feed('5996946660000', 'ean13', 1000)).toBe(null);

    // 2 frame valid lalu tersela 1 frame ngawur -> streak harus reset
    expect(filter.feed('8999909982000', 'ean13', 1050)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 1100)).toBe(null);
    expect(filter.feed('5996946660000', 'ean13', 1150)).toBe(null);

    // Butuh 3 frame identik baru agar lolos
    expect(filter.feed('8999909982000', 'ean13', 1200)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 1250)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 1300)).toBe('8999909982000');
  });

  test('menerapkan global cooldown 1200ms pasca-scan bahkan untuk kode berbeda', () => {
    const filter = new BarcodeScanConsensus();

    expect(filter.feed('8999909982000', 'ean13', 1000)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 1050)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 1100)).toBe('8999909982000');

    // Kode berbeda 50ms kemudian tetap diblokir selama global cooldown 1200ms
    expect(filter.feed('5996946660000', 'ean13', 1150)).toBe(null);
    expect(filter.feed('5996946660000', 'ean13', 1200)).toBe(null);
    expect(filter.feed('5996946660000', 'ean13', 1250)).toBe(null);

    // Setelah cooldown berlalu (>= 2300ms), scan baru diterima lagi setelah 3 frame
    expect(filter.feed('8999909982000', 'ean13', 2400)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 2450)).toBe(null);
    expect(filter.feed('8999909982000', 'ean13', 2500)).toBe('8999909982000');
  });

  test('meloloskan QR code setelah 2 frame identik dan mereset jika jeda terlalu lama', () => {
    const filter = new BarcodeScanConsensus();

    expect(filter.feed('QR-ITEM-01', 'qr', 1000)).toBe(null);
    // Jeda > 650ms mereset streak
    expect(filter.feed('QR-ITEM-01', 'qr', 1800)).toBe(null);
    // Frame ke-2 dalam window 650ms langsung lolos
    expect(filter.feed('QR-ITEM-01', 'qr', 1900)).toBe('QR-ITEM-01');
  });
});
