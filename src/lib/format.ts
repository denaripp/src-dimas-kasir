export type ReportPeriod = 'today' | '7d' | 'month' | 'custom';

export interface UtcDateRange {
  startIso: string;
  endIso: string;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const ID_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Mengurai timestamp (termasuk variasi format timestamptz PostgreSQL seperti
 * spasi pemisah, 6 digit mikrodetik, atau offset 2 digit +00) secara aman
 * di semua engine JS termasuk Android Hermes.
 */
export function parseTimestampSafe(
  input: Date | string | number | null | undefined,
): Date | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let normalized = input.trim();
  if (!normalized) {
    return null;
  }

  // PostgreSQL timestamptz text format: "YYYY-MM-DD HH:mm:ss.123456+00" -> ISO-8601
  normalized = normalized.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');
  // Potong mikrodetik (>3 digit) ke milidetik (3 digit) untuk kompatibilitas Hermes
  normalized = normalized.replace(/(\.\d{3})\d+/, '$1');
  // Normalisasi offset 2 digit (+00) atau 4 digit tanpa titik dua (+0700) -> +00:00
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

  // Jika ISO datetime tanpa penanda timezone, perlakukan sebagai UTC (standar server Supabase)
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) &&
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)
  ) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWibDateParts(date: Date) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth() + 1,
    day: wib.getUTCDate(),
    hours: wib.getUTCHours(),
    minutes: wib.getUTCMinutes(),
    seconds: wib.getUTCSeconds(),
  };
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
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}${m}${d}`;
}

/**
 * Menghasilkan tanggal lokal perangkat dalam format YYYY-MM-DD (untuk kolom DATE SQL).
 */
export function formatIsoDateLocal(date: Date = new Date()): string {
  const y = date.getFullYear().toString();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Format tanggal dan jam struk dalam WIB (UTC+7) secara deterministik:
 * DD/MM/YYYY HH:mm (contoh: 24/11/2026 19:32, tanpa detik).
 * Jika input kosong/tidak valid, fallback otomatis ke waktu sekarang (real-time).
 */
export function formatReceiptDateTime(
  input?: Date | string | number | null,
): string {
  const date = parseTimestampSafe(input) ?? new Date();
  const { day, month, year, hours, minutes } = getWibDateParts(date);
  return `${pad2(day)}/${pad2(month)}/${year} ${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Format tanggal dan jam WIB (contoh: 23 Nov 2026, 19:42).
 */
export function formatDateTime(input: Date | string | number): string {
  const date = parseTimestampSafe(input);
  if (!date) {
    return '-';
  }
  const { day, month, year, hours, minutes } = getWibDateParts(date);
  return `${pad2(day)} ${ID_MONTHS_SHORT[month - 1]} ${year}, ${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Format jam WIB (HH:mm).
 */
export function formatTimeOnly(input: Date | string | number): string {
  const date = parseTimestampSafe(input);
  if (!date) {
    return '--:--';
  }
  const { hours, minutes } = getWibDateParts(date);
  return `${pad2(hours)}:${pad2(minutes)}`;
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
