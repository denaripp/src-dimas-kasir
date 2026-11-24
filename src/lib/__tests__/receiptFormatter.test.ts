import { describe, expect, test } from 'bun:test';
import type { SaleItemRow, SaleRow } from '@/types/database';
import {
  buildEscPosReceiptText,
  buildReceiptHtml,
  buildTestReceiptText,
  formatTwoColumns,
  getReceiptLineWidth,
  isTrustedLogoUrl,
  sanitizeEscPosText,
  type ReceiptStoreInfo,
} from '../receiptFormatter';

// Sengaja isi profil DB berbeda untuk memastikan struk 100% mengabaikan profil akun Google/DB
const foreignProfileStore: ReceiptStoreInfo = {
  name: 'Akun Google Orang Lain',
  address: 'Alamat Profil Salah No. 99',
  phone: '08999999999',
  logo_url:
    'https://xjhulqlklbigwugpsonx.supabase.co/storage/v1/object/public/store-logos/u1/logo.png',
  receipt_footer: 'Footer Profil Salah',
  paper_size: 58,
};

const sampleSale: SaleRow = {
  id: 'sale-1',
  store_id: 'store-1',
  receipt_number: 'SDK-20261124-0001',
  total_amount: 14000,
  cash_received: 50000,
  change_amount: 36000,
  status: 'completed',
  void_reason: null,
  voided_at: null,
  created_at: '2026-11-24T11:45:12.123456+00:00', // 18:45 WIB
};

const sampleItems: SaleItemRow[] = [
  {
    id: 'item-1',
    sale_id: 'sale-1',
    product_id: 'prod-1',
    product_name_snapshot: 'Indomie Goreng',
    qty: 4,
    sell_price_snapshot: 3500,
    cost_price_snapshot: 2800,
    subtotal: 14000,
  },
];

describe('receiptFormatter', () => {
  test('menentukan lebar karakter 32 untuk 58mm dan 48 untuk 80mm', () => {
    expect(getReceiptLineWidth(58)).toBe(32);
    expect(getReceiptLineWidth(80)).toBe(48);
  });

  test('formatTwoColumns menjaga lebar kolom tepat dan mempertahankan indentasi kiri', () => {
    const line = formatTwoColumns('  4 x Rp3.500', 'Rp14.000', 32);
    expect(line.length).toBe(32);
    expect(line.startsWith('  4 x Rp3.500')).toBe(true);
    expect(line.endsWith('Rp14.000')).toBe(true);
  });

  test('buildEscPosReceiptText mengunci TOKO SRC DIMAS, layout lega tanpa <B> raksasa, dan 1 baris Tanggal WIB', () => {
    const text = buildEscPosReceiptText(sampleSale, sampleItems, foreignProfileStore);

    // Identitas wajib TOKO SRC DIMAS
    expect(text).toContain('<CB>TOKO SRC DIMAS</CB>');
    expect(text).toContain('Jl. Raya Belawa Wangkelang,');
    expect(text).toContain('Desa Wangkelang');
    expect(text).toContain('Kasir     : Toko SRC Dimas');
    expect(text).toContain('Terima Kasih Telah Berbelanja');
    expect(text).toContain('di Toko SRC DIMAS');

    // Dilarang bocor data profil DB / Google
    expect(text).not.toContain('Akun Google Orang Lain');
    expect(text).not.toContain('Alamat Profil Salah');
    expect(text).not.toContain('Footer Profil Salah');
    expect(text).not.toContain('08999999999');

    // Tanpa tag <B> (4x raksasa), tanpa garis ganda sempit, tanpa baris duplikat Dicetak
    expect(text).not.toContain('<B>');
    expect(text).not.toContain('</B>');
    expect(text).not.toContain('================================');
    expect(text).not.toContain('Dicetak');

    // Jam wajib WIB tanpa detik (11:45:12 UTC -> 18:45 WIB)
    expect(text).toContain('No. Struk : SDK-20261124-0001');
    expect(text).toContain('Tanggal   : 24/11/2026 18:45');

    // Ringkasan sejajar tepat 32 karakter per baris
    const lines = text.split('\n');
    const totalItemLine = lines.find((l) => l.startsWith('Total Item'));
    const totalLine = lines.find((l) => l.startsWith('TOTAL'));
    const tunaiLine = lines.find((l) => l.startsWith('TUNAI'));
    const kembaliLine = lines.find((l) => l.startsWith('KEMBALI'));
    expect(totalItemLine?.length).toBe(32);
    expect(totalLine?.length).toBe(32);
    expect(tunaiLine?.length).toBe(32);
    expect(kembaliLine?.length).toBe(32);
    expect(totalLine?.endsWith('Rp14.000')).toBe(true);
    expect(tunaiLine?.endsWith('Rp50.000')).toBe(true);
    expect(kembaliLine?.endsWith('Rp36.000')).toBe(true);
  });

  test('buildReceiptHtml mengunci TOKO SRC DIMAS, jam WIB tanpa detik, VOID, dan escape HTML aman', () => {
    const voidSale: SaleRow = {
      ...sampleSale,
      status: 'void',
      void_reason: 'Salah <input>',
      voided_at: '2026-11-24T13:00:00.000Z',
    };
    const html = buildReceiptHtml(voidSale, sampleItems, {
      ...foreignProfileStore,
      paper_size: 80,
    });
    expect(html).toContain('width: 80mm');
    expect(html).toContain('TOKO SRC DIMAS');
    expect(html).toContain('Jl. Raya Belawa Wangkelang, Desa Wangkelang');
    expect(html).toContain('Kasir     : Toko SRC Dimas');
    expect(html).toContain('Tanggal   : 24/11/2026 18:45');
    expect(html).not.toContain('Dicetak');
    expect(html).not.toContain('Akun Google Orang Lain');
    expect(html).not.toContain('store-logos');
    expect(html).toContain('*** TRANSAKSI VOID ***');
    expect(html).toContain('Salah &lt;input&gt;');
  });

  test('buildTestReceiptText selalu memakai TOKO SRC DIMAS dan waktu WIB tanpa detik', () => {
    const slip = buildTestReceiptText({
      paper_size: 58,
      printedAt: '2026-11-24T11:50:30.000Z', // 18:50 WIB
    });
    expect(slip).toContain('<CB>TOKO SRC DIMAS</CB>');
    expect(slip).toContain('TES CETAK PRINTER 58mm');
    expect(slip).toContain('24/11/2026 18:50');
    expect(slip).toContain('Rp15.000');
  });

  test('sanitizeEscPosText membersihkan byte kontrol ESC/GS dan tag markup (F-07)', () => {
    const malicious = '\x1B@\x1DV0<CB>GRATIS</CB>\nKopi';
    const clean = sanitizeEscPosText(malicious);
    expect(clean).not.toContain('\x1B');
    expect(clean).not.toContain('\x1D');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
    expect(clean).toContain('Kopi');

    const payload = buildEscPosReceiptText(
      sampleSale,
      [{ ...sampleItems[0], product_name_snapshot: malicious }],
      { paper_size: 58 },
    );
    expect(payload).not.toContain('\x1B');
    expect(payload).not.toContain('\x1D');
    expect(payload).not.toContain('<CB>GRATIS</CB>');
  });

  test('isTrustedLogoUrl hanya mengizinkan HTTPS Supabase Storage store-logos', () => {
    expect(
      isTrustedLogoUrl(
        'https://xjhulqlklbigwugpsonx.supabase.co/storage/v1/object/public/store-logos/u1/logo.png',
      ),
    ).toBe(true);
    expect(isTrustedLogoUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedLogoUrl('http://evil.example/logo.png')).toBe(false);
    expect(isTrustedLogoUrl('file:///etc/passwd')).toBe(false);
  });
});
