export type ReportPeriod = 'today' | '7d' | 'month' | 'custom';

export interface UtcDateRange {
  startIso: string;
  endIso: string;
}

/**
 * Format bilangan bulat Rupiah ketat sesuai PRD:
 * Rp15.000 (tanpa spasi setelah Rp, pemisah titik ribuan, tanpa desimal ,00).
 */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    return 'Rp0';
  }
  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp${digits}` : `Rp${digits}`;
}

/**
 * Format nomor struk sesuai PRD: SDK-YYYYMMDD-XXXX.
 */
export function formatReceiptNumber(localDateKey: string, sequence: number): string {
  const cleanDate = localDateKey.replace(/[^0-9]/g, '').slice(0, 8);
  const seq = Math.max(1, Math.floor(sequence)).toString().padStart(4, '0');
  return `SDK-${cleanDate}-${seq}`;
}

/**
 * Menghasilkan kunci tanggal lokal perangkat dalam format YYYYMMDD.
 */
export function formatLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Menghasilkan tanggal lokal perangkat dalam format YYYY-MM-DD (untuk kolom DATE SQL).
 */
export function formatIsoDateLocal(date: Date = new Date()): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ID_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * Format tanggal dan jam lokal perangkat (contoh: 23 Nov 2026, 19:42).
 */
export function formatDateTime(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const datePart = ID_DATE_FORMATTER.format(date);
  const timePart = formatTimeOnly(date);
  return `${datePart}, ${timePart}`;
}

/**
 * Format jam lokal perangkat (HH:mm).
 */
export function formatTimeOnly(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Mengonversi batas awal (00:00:00.000) dan akhir (23:59:59.999) suatu tanggal lokal
 * ke ISO UTC string untuk query Supabase.
 */
export function getLocalDayRangeUtc(date: Date = new Date()): UtcDateRange {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

/**
 * Menghitung rentang ISO UTC berdasarkan filter periode laporan usaha (zona waktu perangkat).
 */
export function getLocalPeriodRangeUtc(
  period: ReportPeriod,
  customStart?: Date,
  customEnd?: Date,
  now: Date = new Date(),
): UtcDateRange {
  const endToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  if (period === 'today') {
    return getLocalDayRangeUtc(now);
  }

  if (period === '7d') {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0,
    );
    return {
      startIso: start.toISOString(),
      endIso: endToday.toISOString(),
    };
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return {
      startIso: start.toISOString(),
      endIso: endToday.toISOString(),
    };
  }

  const startSrc = customStart ?? now;
  const endSrc = customEnd ?? startSrc;
  const [from, to] = startSrc <= endSrc ? [startSrc, endSrc] : [endSrc, startSrc];

  const start = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate(),
    23,
    59,
    59,
    999,
  );
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
