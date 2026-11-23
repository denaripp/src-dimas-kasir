import { describe, expect, test } from 'bun:test';
import {
  formatDateTime,
  formatIsoDateLocal,
  formatLocalDateKey,
  formatReceiptNumber,
  formatRupiah,
  formatTimeOnly,
  getLocalDayRangeUtc,
  getLocalPeriodRangeUtc,
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

describe('format tanggal & rentang zona waktu lokal', () => {
  test('formatLocalDateKey, formatIsoDateLocal, formatTimeOnly, formatDateTime', () => {
    const sample = new Date(2026, 10, 23, 19, 42, 0);
    expect(formatLocalDateKey(sample)).toBe('20261123');
    expect(formatIsoDateLocal(sample)).toBe('2026-11-23');
    expect(formatTimeOnly(sample)).toBe('19:42');
    expect(formatDateTime(sample)).toContain('19:42');
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
