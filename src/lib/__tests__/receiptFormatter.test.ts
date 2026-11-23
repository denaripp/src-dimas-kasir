import { describe, expect, test } from 'bun:test';
import type { SaleItemRow, SaleRow } from '@/types/database';
import {
  buildEscPosReceiptText,
  buildReceiptHtml,
  buildTestReceiptText,
  formatTwoColumns,
  getReceiptLineWidth,
  type ReceiptStoreInfo,
} from '../receiptFormatter';

const sampleStore: ReceiptStoreInfo = {
  name: 'Toko Dimas',
  address: 'Jl. Merdeka No. 12',
  phone: '08123456789',
  logo_url: null,
  receipt_footer: 'Terima kasih telah berbelanja!',
  paper_size: 58,
};

const sampleSale: SaleRow = {
  id: 'sale-1',
  store_id: 'store-1',
  receipt_number: 'SDK-20261123-0001',
  total_amount: 7000,
  cash_received: 10000,
  change_amount: 3000,
  status: 'completed',
  void_reason: null,
  voided_at: null,
  created_at: '2026-11-23T12:42:00.000Z',
};

const sampleItems: SaleItemRow[] = [
  {
    id: 'item-1',
    sale_id: 'sale-1',
    product_id: 'prod-1',
    product_name_snapshot: 'Indomie Goreng',
    qty: 2,
    sell_price_snapshot: 3500,
    cost_price_snapshot: 2800,
    subtotal: 7000,
  },
];

describe('receiptFormatter', () => {
  test('menentukan lebar karakter 32 untuk 58mm dan 48 untuk 80mm', () => {
    expect(getReceiptLineWidth(58)).toBe(32);
    expect(getReceiptLineWidth(80)).toBe(48);
  });

  test('formatTwoColumns menjaga lebar kolom tepat tanpa melampaui batas', () => {
    const line = formatTwoColumns('2 x Rp3.500', 'Rp7.000', 32);
    expect(line.length).toBe(32);
    expect(line).toContain('2 x Rp3.500');
    expect(line).toContain('Rp7.000');
  });

  test('buildEscPosReceiptText memuat nomor struk, item, format Rp tanpa spasi, dan footer', () => {
    const text = buildEscPosReceiptText(sampleSale, sampleItems, sampleStore);
    expect(text).toContain('Toko Dimas');
    expect(text).toContain('SDK-20261123-0001');
    expect(text).toContain('Indomie Goreng');
    expect(text).toContain('Rp7.000');
    expect(text).toContain('Rp10.000');
    expect(text).toContain('Rp3.000');
    expect(text).toContain('Terima kasih telah berbelanja!');
  });

  test('buildReceiptHtml menampilkan tanda VOID dan meng-escape HTML dengan aman', () => {
    const voidSale: SaleRow = {
      ...sampleSale,
      status: 'void',
      void_reason: 'Salah <input>',
      voided_at: '2026-11-23T13:00:00.000Z',
    };
    const html = buildReceiptHtml(voidSale, sampleItems, {
      ...sampleStore,
      paper_size: 80,
    });
    expect(html).toContain('width: 80mm');
    expect(html).toContain('TRANSAKSI VOID');
    expect(html).toContain('Salah &lt;input&gt;');
  });

  test('buildTestReceiptText menghasilkan slip tes cetak sesuai ukuran kertas', () => {
    const slip = buildTestReceiptText({ name: 'Toko Dimas', paper_size: 58 });
    expect(slip).toContain('TES CETAK PRINTER 58mm');
    expect(slip).toContain('Rp15.000');
  });
});
