import type { ProductRow } from '@/types/database';

export function extractProductCategories(products: readonly ProductRow[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const cat = p.category.trim();
    if (cat) set.add(cat);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function countLowStockProducts(products: readonly ProductRow[]): number {
  let count = 0;
  for (const p of products) {
    if (p.stock <= p.min_stock) count += 1;
  }
  return count;
}

export function filterProducts(
  products: readonly ProductRow[],
  options: {
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
  },
): ProductRow[] {
  const q = (options.search ?? '').trim().toLowerCase();
  const category = options.category && options.category !== 'all' ? options.category : null;
  const lowStockOnly = Boolean(options.lowStockOnly);

  if (!q && !category && !lowStockOnly) {
    return products as ProductRow[];
  }

  return products.filter((p) => {
    if (lowStockOnly && p.stock > p.min_stock) {
      return false;
    }
    if (category && p.category.trim() !== category) {
      return false;
    }
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });
}
