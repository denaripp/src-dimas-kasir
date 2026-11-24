import Papa from 'papaparse';
import { formatIsoDateLocal, formatRupiah } from '@/lib/format';
import type {
  ExpenseRow,
  ProductRow,
  SaleItemRow,
  SaleRow,
} from '@/types/database';

export interface SaleWithItems extends SaleRow {
  sale_items: SaleItemRow[];
}

export interface TopProductItem {
  productId: string;
  name: string;
  totalQty: number;
  totalRevenue: number;
}

export interface DailySalesPoint {
  dateKey: string; // YYYY-MM-DD (lokal perangkat)
  label: string;
  totalSales: number;
  txCount: number;
}

export interface ReportSummary {
  totalSales: number;
  completedCount: number;
  voidCount: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  topProducts: TopProductItem[];
  dailySeries: DailySalesPoint[];
}

const SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatShortDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d);
  return `${SHORT_DAYS[date.getDay()]} ${d}`;
}

/**
 * Menghitung ringkasan laporan usaha sesuai rumus PRD 3.8 & 3.9:
 * - Hanya transaksi berstatus 'completed' yang dihitung (void diabaikan).
 * - Laba Kotor = SUM((sell_price_snapshot - cost_price_snapshot) * qty).
 * - Laba Bersih = Laba Kotor - Total Pengeluaran Periode.
 * - Top 5 barang terlaris berdasarkan total unit terjual (qty).
 */
export function computeReportSummary(
  sales: readonly SaleWithItems[],
  expenses: readonly ExpenseRow[],
): ReportSummary {
  let totalSales = 0;
  let completedCount = 0;
  let voidCount = 0;
  let grossProfit = 0;

  const productMap = new Map<string, TopProductItem>();
  const dailyMap = new Map<string, DailySalesPoint>();

  for (const sale of sales) {
    if (sale.status === 'void') {
      voidCount += 1;
      continue;
    }

    completedCount += 1;
    totalSales += sale.total_amount;

    const localKey = formatIsoDateLocal(new Date(sale.created_at));
    const existingDay = dailyMap.get(localKey);
    if (existingDay) {
      existingDay.totalSales += sale.total_amount;
      existingDay.txCount += 1;
    } else {
      dailyMap.set(localKey, {
        dateKey: localKey,
        label: formatShortDayLabel(localKey),
        totalSales: sale.total_amount,
        txCount: 1,
      });
    }

    for (const item of sale.sale_items ?? []) {
      const itemProfit = (item.sell_price_snapshot - item.cost_price_snapshot) * item.qty;
      grossProfit += itemProfit;

      const existingProd = productMap.get(item.product_id);
      if (existingProd) {
        existingProd.totalQty += item.qty;
        existingProd.totalRevenue += item.subtotal;
      } else {
        productMap.set(item.product_id, {
          productId: item.product_id,
          name: item.product_name_snapshot,
          totalQty: item.qty,
          totalRevenue: item.subtotal,
        });
      }
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalQty - a.totalQty || b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const dailySeries = Array.from(dailyMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );

  return {
    totalSales,
    completedCount,
    voidCount,
    grossProfit,
    totalExpenses,
    netProfit,
    topProducts,
    dailySeries,
  };
}

/**
 * Mengekspor laporan usaha periode terpilih ke format CSV (PRD 3.9).
 */
export function generateReportCsv(
  storeName: string,
  periodLabel: string,
  summary: ReportSummary,
  lowStockProducts: readonly ProductRow[],
): string {
  const rows: (string | number)[][] = [
    ['Laporan Usaha', storeName],
    ['Periode', periodLabel],
    [],
    ['Ringkasan', 'Nilai'],
    ['Total Penjualan', formatRupiah(summary.totalSales)],
    ['Jumlah Transaksi Selesai', summary.completedCount],
    ['Jumlah Transaksi Void', summary.voidCount],
    ['Laba Kotor', formatRupiah(summary.grossProfit)],
    ['Total Pengeluaran', formatRupiah(summary.totalExpenses)],
    ['Laba Bersih', formatRupiah(summary.netProfit)],
    [],
    ['Top 5 Barang Terlaris', 'Unit Terjual', 'Omzet'],
    ...summary.topProducts.map((p) => [p.name, p.totalQty, p.totalRevenue]),
    [],
    ['Tren Harian (Tanggal)', 'Jumlah Transaksi', 'Total Penjualan'],
    ...summary.dailySeries.map((d) => [d.dateKey, d.txCount, d.totalSales]),
    [],
    ['Stok Menipis (Barang)', 'Stok Saat Ini', 'Stok Minimum'],
    ...lowStockProducts.map((p) => [p.name, p.stock, p.min_stock]),
  ];

  return Papa.unparse(rows, {
    newline: '\n',
    escapeFormulae: /^[\s]*[=+\-@\t\r]/,
  });
}
