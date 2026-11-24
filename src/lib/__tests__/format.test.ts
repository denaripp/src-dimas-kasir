import { describe, expect, test } from 'bun:test';
import {
  formatDateTime,
  formatIsoDateLocal,
  formatLocalDateKey,
  formatReceiptDateTime,
  formatReceiptNumber,
  formatRupiah,
  formatTimeOnly,
  getLocalDayRangeUtc,
  getLocalPeriodRangeUtc,
  parseTimestampSafe,
} from '../format';

describe('formatRupiah', () => {
  test('memformat ribuan tanpa spasi dan tanpa desimal ,00', () => {
    expect(formatRupiah(15000)).toBe('Rp15.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(3500)).toBe('Rp3.500');
    expect(formatRupiah(1485000)).toBe('Rp1.485.000');
  });

  test('menangani angka negatif, pecahan, dan non-finite', () => {
    expect(formatRupiah(-5000)).toBe('-Rp5.000');
    expect(formatRupiah(15000.4)).toBe('Rp15.000');
    expect(formatRupiah(Number.NaN)).toBe('Rp0');
  });
});

describe('formatReceiptNumber', () => {
  test('menghasilkan format SDK-YYYYMMDD-XXXX', () => {
    expect(formatReceiptNumber('20261123', 1)).toBe('SDK-20261123-0001');
    expect(formatReceiptNumber('2026-11-23', 34)).toBe('SDK-20261123-0034');
    expect(formatReceiptNumber('20261123', 1200)).toBe('SDK-20261123-1200');
  });
});

describe('parseTimestampSafe & formatReceiptDateTime (WIB UTC+7)', () => {
  test('mengurai berbagai format timestamptz PostgreSQL secara aman', () => {
    const isoMicro = parseTimestampSafe('2026-11-24T11:45:12.123456+00:00');
    const pgSpaceShortOffset = parseTimestampSafe('2026-11-24 11:45:12.987654+00');
    const isoNoTz = parseTimestampSafe('2026-11-24T11:45:12');

    expect(isoMicro !== null).toBe(true);
    expect(pgSpaceShortOffset !== null).toBe(true);
    expect(isoNoTz !== null).toBe(true);
    expect(parseTimestampSafe('invalid')).toBe(null);
    expect(parseTimestampSafe('')).toBe(null);
    expect(parseTimestampSafe(null)).toBe(null);
  });

  test('formatReceiptDateTime selalu mengonversi UTC ke WIB (UTC+7) format DD/MM/YYYY HH:mm', () => {
    // 11:45:12 UTC = 18:45 WIB (tanpa detik)
    expect(formatReceiptDateTime('2026-11-24T11:45:12.123456+00:00')).toBe(
      '24/11/2026 18:45',
    );
    expect(formatReceiptDateTime('2026-11-24 11:45:12.987654+00')).toBe(
      '24/11/2026 18:45',
    );
    // Pergantian hari UTC -> WIB: 23 Nov 18:30:05 UTC = 24 Nov 01:30 WIB
    expect(formatReceiptDateTime('2026-11-23T18:30:05.000Z')).toBe(
      '24/11/2026 01:30',
    );
  });

  test('formatReceiptDateTime fallback ke waktu real-time sekarang jika input kosong/invalid', () => {
    const formatted = formatReceiptDateTime(null);
    expect(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(formatted)).toBe(true);
  });
});

describe('format tanggal & rentang zona waktu lokal', () => {
  test('formatLocalDateKey, formatIsoDateLocal, formatTimeOnly, formatDateTime', () => {
    const sample = new Date('2026-11-23T12:42:00.000Z'); // 19:42 WIB
    expect(formatLocalDateKey(new Date(2026, 10, 23, 19, 42, 0))).toBe('20261123');
    expect(formatIsoDateLocal(new Date(2026, 10, 23, 19, 42, 0))).toBe('2026-11-23');
    expect(formatTimeOnly(sample)).toBe('19:42');
    expect(formatDateTime(sample)).toBe('23 Nov 2026, 19:42');
    expect(formatDateTime('invalid')).toBe('-');
  });

  test('getLocalDayRangeUtc mencakup tepat 1 hari lokal penuh', () => {
    const sample = new Date(2026, 10, 23, 14, 15, 0);
    const { startIso, endIso } = getLocalDayRangeUtc(sample);
    const start = new Date(startIso);
    const end = new Date(endIso);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(23);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  test('getLocalPeriodRangeUtc mendukung today, 7d, month, dan custom', () => {
    const now = new Date(2026, 10, 23, 10, 0, 0);

    const sevenDays = getLocalPeriodRangeUtc('7d', undefined, undefined, now);
    const start7d = new Date(sevenDays.startIso);
    expect(start7d.getDate()).toBe(17);

    const month = getLocalPeriodRangeUtc('month', undefined, undefined, now);
    const startMonth = new Date(month.startIso);
    expect(startMonth.getDate()).toBe(1);
    expect(startMonth.getMonth()).toBe(10);

    const customSwapped = getLocalPeriodRangeUtc(
      'custom',
      new Date(2026, 10, 20),
      new Date(2026, 10, 10),
      now,
    );
    expect(new Date(customSwapped.startIso).getDate()).toBe(10);
    expect(new Date(customSwapped.endIso).getDate()).toBe(20);
  });
});
