import Papa from 'papaparse';
import type { CsvImportProductRow, ProductRow } from '@/types/database';

export const CSV_MAX_ROWS = 1000;
export const CSV_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const PG_INT4_MAX = 2_147_483_647;
export const CSV_FORMULA_ESCAPE_REGEX = /^[\s]*[=+\-@\t\r]/;

export const CSV_HEADERS = [
  'nama',
  'barcode',
  'kategori',
  'harga_jual',
  'harga_modal',
  'stok',
  'stok_minimum',
] as const;

export interface CsvValidRow {
  rowNumber: number;
  data: CsvImportProductRow;
}

export interface CsvErrorRow {
  rowNumber: number;
  rawName: string;
  rawBarcode: string;
  reasons: string[];
}

export interface CsvParseResult {
  totalRows: number;
  validRows: CsvValidRow[];
  errorRows: CsvErrorRow[];
  fatalError: string | null;
}

function parseNonNegativeInteger(
  raw: string | undefined,
  fieldLabel: string,
  required: boolean,
): { value: number; error: string | null } {
  const trimmed = (raw ?? '').trim();

  if (trimmed === '') {
    if (required) {
      return { value: 0, error: `${fieldLabel} wajib diisi` };
    }
    return { value: 0, error: null };
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return { value: 0, error: `${fieldLabel} harus bilangan bulat (tanpa desimal/huruf)` };
  }

  const num = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(num) || num < 0) {
    return { value: 0, error: `${fieldLabel} tidak boleh negatif` };
  }
  if (num > PG_INT4_MAX) {
    return {
      value: 0,
      error: `${fieldLabel} melebihi batas maksimal (${PG_INT4_MAX})`,
    };
  }

  return { value: num, error: null };
}

/**
 * Mengurai & memvalidasi teks CSV barang sesuai aturan PRD 3.10:
 * - Header tetap: nama,barcode,kategori,harga_jual,harga_modal,stok,stok_minimum
 * - Wajib: nama & harga_jual
 * - Harga & stok: bilangan bulat >= 0
 * - Barcode duplikat di dalam file: baris kedua dst ditandai error
 * - Maksimal 1.000 baris data
 */
export function parseProductsCsv(csvText: string): CsvParseResult {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();

  if (!cleanText) {
    return {
      totalRows: 0,
      validRows: [],
      errorRows: [],
      fatalError: 'File CSV kosong.',
    };
  }

  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: 'greedy',
    preview: CSV_MAX_ROWS + 2,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('nama') || !fields.includes('harga_jual')) {
    return {
      totalRows: 0,
      validRows: [],
      errorRows: [],
      fatalError:
        'Header CSV wajib memiliki kolom "nama" dan "harga_jual". Gunakan template standar.',
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      errorRows: [],
      fatalError: 'Tidak ada baris data di dalam file CSV.',
    };
  }

  if (rows.length > CSV_MAX_ROWS) {
    return {
      totalRows: rows.length,
      validRows: [],
      errorRows: [],
      fatalError: `Jumlah baris (${rows.length}) melebihi batas maksimal ${CSV_MAX_ROWS} baris per file.`,
    };
  }

  const validRows: CsvValidRow[] = [];
  const errorRows: CsvErrorRow[] = [];
  const seenBarcodes = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // Baris 1 adalah header
    const reasons: string[] = [];

    const name = (row.nama ?? '').trim();
    const barcode = (row.barcode ?? '').trim();
    const category = (row.kategori ?? '').trim();

    if (!name) {
      reasons.push('Kolom nama wajib diisi');
    }

    const sellPrice = parseNonNegativeInteger(row.harga_jual, 'harga_jual', true);
    if (sellPrice.error) reasons.push(sellPrice.error);

    const costPrice = parseNonNegativeInteger(row.harga_modal, 'harga_modal', false);
    if (costPrice.error) reasons.push(costPrice.error);

    const stock = parseNonNegativeInteger(row.stok, 'stok', false);
    if (stock.error) reasons.push(stock.error);

    const minStock = parseNonNegativeInteger(row.stok_minimum, 'stok_minimum', false);
    if (minStock.error) reasons.push(minStock.error);

    if (barcode !== '') {
      const firstSeenRow = seenBarcodes.get(barcode);
      if (firstSeenRow !== undefined) {
        reasons.push(`Barcode duplikat di dalam file (sudah ada di baris ${firstSeenRow})`);
      } else {
        seenBarcodes.set(barcode, rowNumber);
      }
    }

    if (reasons.length > 0) {
      errorRows.push({
        rowNumber,
        rawName: name || '(Tanpa nama)',
        rawBarcode: barcode,
        reasons,
      });
      return;
    }

    validRows.push({
      rowNumber,
      data: {
        name,
        barcode: barcode || null,
        category,
        sell_price: sellPrice.value,
        cost_price: costPrice.value,
        stock: stock.value,
        min_stock: minStock.value,
      },
    });
  });

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    fatalError: null,
  };
}

/**
 * Mengekspor seluruh barang aktif ke format CSV sesuai template PRD 3.10.
 */
export function generateProductsCsv(products: ProductRow[]): string {
  const rows = products.map((product) => ({
    nama: product.name,
    barcode: product.barcode ?? '',
    kategori: product.category ?? '',
    harga_jual: product.sell_price,
    harga_modal: product.cost_price,
    stok: product.stock,
    stok_minimum: product.min_stock,
  }));

  return Papa.unparse(
    {
      fields: [...CSV_HEADERS],
      data: rows.map((r) => [
        r.nama,
        r.barcode,
        r.kategori,
        r.harga_jual,
        r.harga_modal,
        r.stok,
        r.stok_minimum,
      ]),
    },
    { newline: '\n', escapeFormulae: CSV_FORMULA_ESCAPE_REGEX },
  );
}

/**
 * Template CSV kosong beserta 1 baris contoh sesuai PRD 3.10.
 */
export function getProductsCsvTemplate(): string {
  return [
    CSV_HEADERS.join(','),
    'Indomie Goreng Original,8998866200578,Makanan,3500,2800,20,5',
  ].join('\n');
}
