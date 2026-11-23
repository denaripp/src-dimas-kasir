import { describe, expect, test } from 'bun:test';
import {
  calculateCartItemCount,
  calculateCartTotal,
  calculateChange,
  parseSaleRpcError,
  validateCartStock,
  type CartCalcItem,
} from '../cartCalc';

const sampleItems: CartCalcItem[] = [
  { productId: '1', name: 'Indomie Goreng', sellPrice: 3500, availableStock: 10, qty: 2 },
  { productId: '2', name: 'Air Mineral', sellPrice: 4000, availableStock: 5, qty: 1 },
];

describe('cartCalc', () => {
  test('menghitung total belanja dan jumlah unit keranjang', () => {
    expect(calculateCartTotal(sampleItems)).toBe(11000);
    expect(calculateCartItemCount(sampleItems)).toBe(3);
    expect(calculateCartTotal([])).toBe(0);
  });

  test('menghitung kembalian saat uang cukup dan kekurangan saat uang kurang', () => {
    expect(calculateChange(7000, 10000)).toEqual({
      isEnough: true,
      change: 3000,
      shortfall: 0,
    });
    expect(calculateChange(7000, 7000)).toEqual({
      isEnough: true,
      change: 0,
      shortfall: 0,
    });
    expect(calculateChange(15000, 10000)).toEqual({
      isEnough: false,
      change: 0,
      shortfall: 5000,
    });
  });

  test('memvalidasi ketersediaan stok keranjang', () => {
    expect(validateCartStock(sampleItems)).toBe(null);
    const overStock: CartCalcItem[] = [
      { productId: '2', name: 'Air Mineral', sellPrice: 4000, availableStock: 1, qty: 2 },
    ];
    expect(validateCartStock(overStock)).toContain('tidak cukup');
  });

  test('menerjemahkan kode error RPC transaksi ke pesan bahasa Indonesia', () => {
    expect(parseSaleRpcError('STOK_TIDAK_CUKUP:Air Mineral:1:2')).toBe(
      'Stok Air Mineral tidak cukup (tersisa 1, diminta 2).',
    );
    expect(parseSaleRpcError('UANG_TIDAK_CUKUP:5000:7000')).toContain('kurang');
    expect(parseSaleRpcError('KERANJANG_KOSONG')).toContain('kosong');
  });
});
