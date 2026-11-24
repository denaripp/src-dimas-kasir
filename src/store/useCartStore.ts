import { create } from 'zustand';
import { calculateCartTotal, type CartCalcItem } from '@/lib/cartCalc';
import type { ProductRow } from '@/types/database';

export interface CartItem extends CartCalcItem {
  barcode: string | null;
  imageUrl: string | null;
}

interface CartActionResult {
  ok: boolean;
  error?: string;
}

interface CartStoreState {
  items: CartItem[];
  addItem: (product: ProductRow) => CartActionResult;
  updateQty: (productId: string, nextQty: number) => CartActionResult;
  removeItem: (productId: string) => void;
  syncProductStocks: (products: ProductRow[]) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartStoreState>((set, get) => ({
  items: [],

  addItem: (product) => {
    if (product.stock <= 0) {
      return {
        ok: false,
        error: `Stok ${product.name} habis (tersisa 0).`,
      };
    }

    const existing = get().items.find((i) => i.productId === product.id);
    const nextQty = existing ? existing.qty + 1 : 1;

    if (nextQty > product.stock) {
      return {
        ok: false,
        error: `Stok ${product.name} tidak cukup (tersisa ${product.stock}).`,
      };
    }

    set((state) => {
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  name: product.name,
                  imageUrl: product.image_url ?? null,
                  sellPrice: product.sell_price,
                  availableStock: product.stock,
                  qty: item.qty + 1,
                }
              : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            imageUrl: product.image_url ?? null,
            sellPrice: product.sell_price,
            availableStock: product.stock,
            qty: 1,
          },
        ],
      };
    });

    return { ok: true };
  },

  updateQty: (productId, nextQty) => {
    const target = get().items.find((i) => i.productId === productId);
    if (!target) {
      return { ok: false, error: 'Item tidak ditemukan di keranjang.' };
    }

    if (nextQty <= 0) {
      set((state) => ({
        items: state.items.filter((i) => i.productId !== productId),
      }));
      return { ok: true };
    }

    if (nextQty > target.availableStock) {
      return {
        ok: false,
        error: `Stok ${target.name} tidak cukup (tersisa ${target.availableStock}).`,
      };
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, qty: nextQty } : item,
      ),
    }));

    return { ok: true };
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
  },

  syncProductStocks: (products) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    set((state) => ({
      items: state.items
        .filter((item) => byId.has(item.productId))
        .map((item) => {
          const fresh = byId.get(item.productId)!;
          return {
            ...item,
            name: fresh.name,
            barcode: fresh.barcode,
            imageUrl: fresh.image_url ?? null,
            sellPrice: fresh.sell_price,
            availableStock: fresh.stock,
          };
        }),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotalAmount: () => calculateCartTotal(get().items),
}));
