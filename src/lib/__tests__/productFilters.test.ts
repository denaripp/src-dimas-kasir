import { describe, expect, test } from 'bun:test';
import type { ProductRow } from '@/types/database';
import {
  countLowStockProducts,
  extractProductCategories,
  filterProducts,
} from '../productFilters';

const products: ProductRow[] = [
  {
    id: '1',
    store_id: 's1',
    name: 'Indomie Goreng',
    barcode: '8998866200578',
    category: 'Makanan',
    image_url: null,
    sell_price: 3500,
    cost_price: 2800,
    stock: 2,
    min_stock: 5,
    is_active: true,
    created_at: '2026-11-23T00:00:00Z',
    updated_at: '2026-11-23T00:00:00Z',
  },
  {
    id: '2',
    store_id: 's1',
    name: 'Air Mineral 600ml',
    barcode: '8886008101053',
    category: 'Minuman',
    image_url: null,
    sell_price: 4000,
    cost_price: 2500,
    stock: 20,
    min_stock: 5,
    is_active: true,
    created_at: '2026-11-23T00:00:00Z',
    updated_at: '2026-11-23T00:00:00Z',
  },
];

describe('productFilters', () => {
  test('mengekstrak kategori unik terurut dan menghitung stok menipis', () => {
    expect(extractProductCategories(products)).toEqual(['Makanan', 'Minuman']);
    expect(countLowStockProducts(products)).toBe(1);
  });

  test('memfilter berdasarkan pencarian, kategori, dan stok menipis', () => {
    expect(filterProducts(products, { search: 'indomie' }).length).toBe(1);
    expect(filterProducts(products, { search: '8886008' })[0].id).toBe('2');
    expect(filterProducts(products, { category: 'Minuman' })[0].id).toBe('2');
    expect(filterProducts(products, { lowStockOnly: true })[0].id).toBe('1');
  });
});
