import { describe, expect, test } from 'bun:test';
import { toUserFriendlyError } from '../errorMessage';

describe('toUserFriendlyError', () => {
  test('menyembunyikan error internal PostgreSQL/Supabase dan memakai fallback', () => {
    expect(
      toUserFriendlyError(
        new Error('new row violates row-level security policy for table "products"'),
        'Gagal menyimpan data.',
      ),
    ).toBe('Gagal menyimpan data.');

    expect(
      toUserFriendlyError(
        new Error('PGRST116: JSON object requested, multiple rows returned'),
        'Data tidak ditemukan.',
      ),
    ).toBe('Data tidak ditemukan.');
  });

  test('memetakan error jaringan ke pesan koneksi ramah pengguna', () => {
    expect(
      toUserFriendlyError(new Error('Network request failed'), 'Fallback'),
    ).toContain('Koneksi internet');
  });

  test('mempertahankan pesan domain Bahasa Indonesia yang aman', () => {
    expect(
      toUserFriendlyError(new Error('Stok barang tidak cukup.'), 'Fallback'),
    ).toBe('Stok barang tidak cukup.');
  });
});
