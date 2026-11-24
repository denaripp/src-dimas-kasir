import { describe, expect, test } from 'bun:test';
import type { ProductRow } from '@/types/database';
import {
  CSV_MAX_ROWS,
  generateProductsCsv,
  getProductsCsvTemplate,
  parseProductsCsv,
} from '../csvProducts';

describe('parseProductsCsv', () => {
  test('memvalidasi baris valid & mengisi default 0 untuk angka opsional kosong', () => {
    const csv = [
      'nama,barcode,kategori,harga_jual,harga_modal,stok,stok_minimum',
      'Indomie Goreng,8998866200578,Makanan,3500,2800,10,3',
      'Gula Pasir 1kg,,,17500,,,',
    ].join('\n');

    const res = parseProductsCsv(csv);
    expect(res.fatalError).toBe(null);
    expect(res.totalRows).toBe(2);
    expect(res.errorRows.length).toBe(0);
    expect(res.validRows.length).toBe(2);

    expect(res.validRows[0].data).toEqual({
      name: 'Indomie Goreng',
      barcode: '8998866200578',
      category: 'Makanan',
      sell_price: 3500,
      cost_price: 2800,
      stock: 10,
      min_stock: 3,
    });
    expect(res.validRows[1].data).toEqual({
      name: 'Gula Pasir 1kg',
      barcode: null,
      category: '',
      sell_price: 17500,
      cost_price: 0,
      stock: 0,
      min_stock: 0,
    });
  });

  test('memisahkan baris error (negatif, desimal, nama kosong, barcode duplikat) dari baris valid', () => {
    const csv = [
      'nama,barcode,kategori,harga_jual,harga_modal,stok,stok_minimum',
      'Barang A,899001,Minuman,5000,3000,10,2',
      'Barang B,899002,Minuman,-4000,2000,5,1',
      'Barang C,899003,Minuman,4500.5,2000,5,1',
      ',899004,Minuman,4000,2000,5,1',
      'Barang Duplikat,899001,Minuman,6000,3500,4,1',
    ].join('\n');

    const res = parseProductsCsv(csv);
    expect(res.fatalError).toBe(null);
    expect(res.validRows.length).toBe(1);
    expect(res.errorRows.length).toBe(4);
    expect(res.errorRows[0].reasons[0]).toContain('negatif');
    expect(res.errorRows[1].reasons[0]).toContain('bilangan bulat');
    expect(res.errorRows[2].reasons[0]).toContain('nama');
    expect(res.errorRows[3].reasons[0]).toContain('duplikat');
  });

  test('menolak file melebihi batas maksimal 1.000 baris', () => {
    const header = 'nama,barcode,kategori,harga_jual,harga_modal,stok,stok_minimum';
    const lines = [header];
    for (let i = 1; i <= CSV_MAX_ROWS + 1; i += 1) {
      lines.push(`Barang ${i},,Umum,1000,500,1,0`);
    }

    const res = parseProductsCsv(lines.join('\n'));
    expect(res.fatalError).toContain('1000');
    expect(res.validRows.length).toBe(0);
  });

  test('menolak CSV tanpa kolom wajib nama atau harga_jual', () => {
    const res = parseProductsCsv('title,price\nKopi,3000');
    expect(res.fatalError).toContain('nama');
  });
});

describe('generateProductsCsv & template', () => {
  test('menghasilkan CSV sesuai header standar dan dapat di-parse ulang', () => {
    const products: ProductRow[] = [
      {
        id: 'p1',
        store_id: 's1',
        name: 'Air Mineral 600ml',
        barcode: '8886008101053',
        category: 'Minuman',
        image_url: null,
        sell_price: 4000,
        cost_price: 2500,
        stock: 12,
        min_stock: 5,
        is_active: true,
        created_at: '2026-11-23T00:00:00Z',
        updated_at: '2026-11-23T00:00:00Z',
      },
    ];

    const exported = generateProductsCsv(products);
    const reparsed = parseProductsCsv(exported);
    expect(reparsed.fatalError).toBe(null);
    expect(reparsed.validRows.length).toBe(1);
    expect(reparsed.validRows[0].data.name).toBe('Air Mineral 600ml');
    expect(reparsed.validRows[0].data.sell_price).toBe(4000);

    const templateParsed = parseProductsCsv(getProductsCsvTemplate());
    expect(templateParsed.validRows.length).toBe(1);
  });
});
