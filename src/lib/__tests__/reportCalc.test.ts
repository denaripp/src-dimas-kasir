import { describe, expect, test } from 'bun:test';
import type { ExpenseRow, ProductRow } from '@/types/database';
import {
  computeReportSummary,
  generateReportCsv,
  type SaleWithItems,
} from '../reportCalc';

describe('computeReportSummary', () => {
  test('menghitung laba kotor dari snapshot harga modal, mengabaikan void, dan menghitung laba bersih', () => {
    const sales: SaleWithItems[] = [
      {
        id: 's1',
        store_id: 'st1',
        receipt_number: 'SDK-20261123-0001',
        total_amount: 10000,
        cash_received: 10000,
        change_amount: 0,
        status: 'completed',
        void_reason: null,
        voided_at: null,
        created_at: '2026-11-23T05:00:00.000Z',
        sale_items: [
          {
            id: 'si1',
            sale_id: 's1',
            product_id: 'p1',
            product_name_snapshot: 'Kopi Sachet',
            qty: 2,
            sell_price_snapshot: 5000,
            cost_price_snapshot: 3000,
            subtotal: 10000,
          },
        ],
      },
      {
        id: 's2',
        store_id: 'st1',
        receipt_number: 'SDK-20261123-0002',
        total_amount: 7000,
        cash_received: 10000,
        change_amount: 3000,
        status: 'void',
        void_reason: 'Salah input',
        voided_at: '2026-11-23T06:00:00.000Z',
        created_at: '2026-11-23T05:30:00.000Z',
        sale_items: [
          {
            id: 'si2',
            sale_id: 's2',
            product_id: 'p2',
            product_name_snapshot: 'Indomie',
            qty: 2,
            sell_price_snapshot: 3500,
            cost_price_snapshot: 2800,
            subtotal: 7000,
          },
        ],
      },
    ];

    const expenses: ExpenseRow[] = [
      {
        id: 'e1',
        store_id: 'st1',
        category_id: 'c1',
        category_name_snapshot: 'Listrik & Air',
        amount: 1500,
        note: 'Token',
        expense_date: '2026-11-23',
        created_at: '2026-11-23T04:00:00.000Z',
      },
    ];

    const summary = computeReportSummary(sales, expenses);
    expect(summary.totalSales).toBe(10000);
    expect(summary.completedCount).toBe(1);
    expect(summary.voidCount).toBe(1);
    expect(summary.grossProfit).toBe(4000); // (5000 - 3000) * 2
    expect(summary.totalExpenses).toBe(1500);
    expect(summary.netProfit).toBe(2500); // 4000 - 1500
    expect(summary.topProducts.length).toBe(1);
    expect(summary.topProducts[0].name).toBe('Kopi Sachet');
  });

  test('mengurutkan Top 5 barang terlaris berdasarkan total unit terjual', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => ({
      id: `si-${idx}`,
      sale_id: 's1',
      product_id: `p-${idx}`,
      product_name_snapshot: `Barang ${label}`,
      qty: idx + 1,
      sell_price_snapshot: 1000,
      cost_price_snapshot: 500,
      subtotal: (idx + 1) * 1000,
    }));

    const sales: SaleWithItems[] = [
      {
        id: 's1',
        store_id: 'st1',
        receipt_number: 'SDK-20261123-0001',
        total_amount: 21000,
        cash_received: 25000,
        change_amount: 4000,
        status: 'completed',
        void_reason: null,
        voided_at: null,
        created_at: '2026-11-23T05:00:00.000Z',
        sale_items: items,
      },
    ];

    const summary = computeReportSummary(sales, []);
    expect(summary.topProducts.length).toBe(5);
    expect(summary.topProducts[0].name).toBe('Barang F');
    expect(summary.topProducts[0].totalQty).toBe(6);
    expect(summary.topProducts[4].name).toBe('Barang B');
  });

  test('generateReportCsv menghasilkan ringkasan lengkap dalam format CSV', () => {
    const summary = computeReportSummary([], []);
    const lowStock: ProductRow[] = [
      {
        id: 'p1',
        store_id: 'st1',
        name: 'Indomie Goreng',
        barcode: null,
        category: 'Makanan',
        image_url: null,
        sell_price: 3500,
        cost_price: 2800,
        stock: 2,
        min_stock: 10,
        is_active: true,
        created_at: '2026-11-23T00:00:00Z',
        updated_at: '2026-11-23T00:00:00Z',
      },
    ];

    const csv = generateReportCsv('Toko Dimas', 'Hari Ini', summary, lowStock);
    expect(csv).toContain('Toko Dimas');
    expect(csv).toContain('Hari Ini');
    expect(csv).toContain('Indomie Goreng');
    expect(csv).toContain('Rp0');
  });

  test('generateReportCsv meng-escape formula berbahaya pada nama toko dan barang (F-06)', () => {
    const summary = computeReportSummary([], []);
    const lowStock: ProductRow[] = [
      {
        id: 'p1',
        store_id: 'st1',
        name: '=cmd|"/C calc"!A0',
        barcode: null,
        category: 'Makanan',
        image_url: null,
        sell_price: 3500,
        cost_price: 2800,
        stock: 2,
        min_stock: 10,
        is_active: true,
        created_at: '2026-11-23T00:00:00Z',
        updated_at: '2026-11-23T00:00:00Z',
      },
    ];

    const csv = generateReportCsv('+Toko Evil', 'Hari Ini', summary, lowStock);
    expect(csv).toContain("'+Toko Evil");
    expect(csv).toContain("'=cmd");
  });
});
