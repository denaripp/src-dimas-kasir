import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  CsvImportProductRow,
  DeleteProductSmartResult,
  ImportProductsCsvResult,
  ProductRow,
  StockMovementRow,
} from '@/types/database';

export const PRODUCT_KEYS = {
  all: ['products'] as const,
  list: (storeId: string | undefined) => ['products', 'list', storeId] as const,
  detail: (productId: string | undefined) => ['products', 'detail', productId] as const,
  movements: (productId: string | undefined) =>
    ['stock_movements', 'product', productId] as const,
};

export function useProductsQuery(storeId: string | undefined) {
  return useQuery({
    queryKey: PRODUCT_KEYS.list(storeId),
    enabled: Boolean(storeId),
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId!)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as ProductRow[];
    },
  });
}

export function useProductByIdQuery(productId: string | undefined) {
  return useQuery({
    queryKey: PRODUCT_KEYS.detail(productId),
    enabled: Boolean(productId && productId !== 'new'),
    queryFn: async (): Promise<ProductRow | null> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId!)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      return (data as ProductRow | null) ?? null;
    },
  });
}

export function useStockMovementsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: PRODUCT_KEYS.movements(productId),
    enabled: Boolean(productId),
    queryFn: async (): Promise<StockMovementRow[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as StockMovementRow[];
    },
  });
}

export interface SaveProductInput {
  id?: string;
  store_id: string;
  name: string;
  barcode: string | null;
  category: string;
  sell_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
}

export function useSaveProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveProductInput): Promise<ProductRow> => {
      const cleanBarcode = input.barcode?.trim() ? input.barcode.trim() : null;

      if (input.id) {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: input.name.trim(),
            barcode: cleanBarcode,
            category: input.category.trim(),
            sell_price: input.sell_price,
            cost_price: input.cost_price,
            min_stock: input.min_stock,
          })
          .eq('id', input.id)
          .select('*')
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('Kode barcode sudah digunakan oleh barang aktif lain.');
          }
          throw new Error(error.message);
        }
        return data as ProductRow;
      }

      // Barang baru: insert stok 0 dulu lalu catat mutasi stok awal jika stock > 0
      const { data: created, error: insertError } = await supabase
        .from('products')
        .insert({
          store_id: input.store_id,
          name: input.name.trim(),
          barcode: cleanBarcode,
          category: input.category.trim(),
          sell_price: input.sell_price,
          cost_price: input.cost_price,
          stock: 0,
          min_stock: input.min_stock,
          is_active: true,
        })
        .select('*')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Kode barcode sudah digunakan oleh barang aktif lain.');
        }
        throw new Error(insertError.message);
      }

      const product = created as ProductRow;

      if (input.stock > 0) {
        const { data: updated, error: stockError } = await supabase.rpc(
          'adjust_stock_atomic',
          {
            p_product_id: product.id,
            p_type: 'stok_masuk',
            p_qty_delta: input.stock,
            p_note: 'Stok awal barang baru',
          },
        );

        if (stockError) {
          throw new Error(stockError.message);
        }
        return updated as ProductRow;
      }

      return product;
    },
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.detail(product.id) });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.movements(product.id),
      });
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string): Promise<DeleteProductSmartResult> => {
      const { data, error } = await supabase.rpc('delete_product_smart', {
        p_product_id: productId,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data as DeleteProductSmartResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    },
  });
}

export interface AdjustStockInput {
  productId: string;
  type: 'stok_masuk' | 'penyesuaian';
  qtyDelta: number;
  note: string;
}

export function useAdjustStockMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdjustStockInput): Promise<ProductRow> => {
      const { data, error } = await supabase.rpc('adjust_stock_atomic', {
        p_product_id: input.productId,
        p_type: input.type,
        p_qty_delta: input.qtyDelta,
        p_note: input.note.trim(),
      });

      if (error) {
        if (error.message.includes('STOK_TIDAK_BOLEH_MINUS')) {
          throw new Error('Hasil stok akhir tidak boleh kurang dari 0.');
        }
        if (error.message.includes('ALASAN_PENYESUAIAN_WAJIB')) {
          throw new Error('Alasan penyesuaian wajib diisi.');
        }
        throw new Error(error.message);
      }

      return data as ProductRow;
    },
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.detail(product.id) });
      void queryClient.invalidateQueries({
        queryKey: PRODUCT_KEYS.movements(product.id),
      });
    },
  });
}

export function useImportProductsCsvMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: CsvImportProductRow[]): Promise<ImportProductsCsvResult> => {
      const { data, error } = await supabase.rpc('import_products_csv_atomic', {
        p_rows: rows,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data as ImportProductsCsvResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    },
  });
}
