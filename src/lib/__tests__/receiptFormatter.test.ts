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
  total_amount: 7000,
  cash_received: 10000,
  change_amount: 3000,
  status: 'completed',
  void_reason: null,
  voided_at: null,
  created_at: '2026-11-24T11:45:12.123456+00:00', // 18:45:12 WIB
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

  test('formatTwoColumns menjaga lebar kolom tepat dan mempertahankan indentasi kiri', () => {
    const line = formatTwoColumns('  2 x Rp3.500', 'Rp7.000', 32);
    expect(line.length).toBe(32);
    expect(line.startsWith('  2 x Rp3.500')).toBe(true);
    expect(line.endsWith('Rp7.000')).toBe(true);
  });

  test('buildEscPosReceiptText mengunci brand TOKO SRC DIMAS & jam WIB real-time (abaikan profil DB)', () => {
    const text = buildEscPosReceiptText(sampleSale, sampleItems, foreignProfileStore);
    // Identitas wajib TOKO SRC DIMAS
    expect(text).toContain('================================');
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

    // Jam wajib WIB (11:45:12 UTC -> 18:45:12 WIB)
    expect(text).toContain('No. Struk : SDK-20261124-0001');
    expect(text).toContain('Tanggal   : 24/11/2026 18:45:12');

    // Rincian & ringkasan
    expect(text).toContain('INDOMIE GORENG');
    expect(text).toContain('  2 x Rp3.500');
    expect(text).toContain('Total Item :');
    expect(text).toContain('1 (2 pcs)');
    expect(text).toContain('TOTAL      :');
    expect(text).toContain('TUNAI      :');
    expect(text).toContain('KEMBALI    :');
  });

  test('buildEscPosReceiptText mode cetak ulang (isReprint) menampilkan jam Dicetak real-time WIB', () => {
    const text = buildEscPosReceiptText(sampleSale, sampleItems, {
      paper_size: 58,
      isReprint: true,
      printedAt: '2026-11-24T12:10:05.000Z', // 19:10:05 WIB
    });
    expect(text).toContain('Tanggal   : 24/11/2026 18:45:12');
    expect(text).toContain('Dicetak   : 24/11/2026 19:10:05');
  });

  test('buildReceiptHtml mengunci TOKO SRC DIMAS, jam WIB, VOID, dan escape HTML aman', () => {
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
    expect(html).toContain('Tanggal   : 24/11/2026 18:45:12');
    expect(html).not.toContain('Akun Google Orang Lain');
    expect(html).not.toContain('store-logos');
    expect(html).toContain('*** TRANSAKSI VOID ***');
    expect(html).toContain('Salah &lt;input&gt;');
  });

  test('buildTestReceiptText selalu memakai TOKO SRC DIMAS dan waktu WIB', () => {
    const slip = buildTestReceiptText({
      paper_size: 58,
      printedAt: '2026-11-24T11:50:30.000Z', // 18:50:30 WIB
    });
    expect(slip).toContain('<CB>TOKO SRC DIMAS</CB>');
    expect(slip).toContain('TES CETAK PRINTER 58mm');
    expect(slip).toContain('Waktu       : 24/11/2026 18:50:30');
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
