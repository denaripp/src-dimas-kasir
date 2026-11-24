import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { PRODUCT_KEYS } from '@/hooks/useProducts';
import { parseSaleRpcError } from '@/lib/cartCalc';
import { formatLocalDateKey } from '@/lib/format';
import type { SaleWithItems } from '@/lib/reportCalc';
import { supabase } from '@/lib/supabase';
import type {
  CreateSaleAtomicResult,
  CreateSaleItemInput,
  SaleRow,
} from '@/types/database';

export const SALE_KEYS = {
  all: ['sales'] as const,
  list: (storeId: string | undefined) => ['sales', 'list', storeId] as const,
  detail: (saleId: string | undefined) => ['sales', 'detail', saleId] as const,
};

export interface CreateSaleInput {
  cashReceived: number;
  items: CreateSaleItemInput[];
  localDate?: string;
}

export function useSalesHistoryQuery(storeId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: [...SALE_KEYS.list(storeId), limit],
    enabled: Boolean(storeId),
    queryFn: async (): Promise<SaleWithItems[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as SaleWithItems[];
    },
  });
}

export function useSaleDetailQuery(saleId: string | undefined) {
  return useQuery({
    queryKey: SALE_KEYS.detail(saleId),
    enabled: Boolean(saleId),
    queryFn: async (): Promise<SaleWithItems | null> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', saleId!)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      return (data as SaleWithItems | null) ?? null;
    },
  });
}

/**
 * Langganan Supabase Realtime pada tabel sales (PRD 3.12):
 * Memperbarui History & Dashboard otomatis tanpa refresh manual.
 */
export function useSalesRealtime(storeId: string | undefined) {
  const queryClient = useQueryClient();
  const instanceIdRef = useRef<string>(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );

  useEffect(() => {
    if (!storeId) return;

    const channelName = `sales-realtime-${storeId}-${instanceIdRef.current}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sales',
            filter: `store_id=eq.${storeId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
            void queryClient.invalidateQueries({ queryKey: ['reports'] });
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime subscribe gagal:', err);
    }

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [storeId, queryClient]);
}

export function useCreateSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSaleInput): Promise<CreateSaleAtomicResult> => {
      const localDate = input.localDate ?? formatLocalDateKey();

      const { data, error } = await supabase.rpc('create_sale_atomic', {
        p_local_date: localDate,
        p_cash_received: Math.round(input.cashReceived),
        p_items: input.items,
      });

      if (error) {
        throw new Error(parseSaleRpcError(error.message));
      }

      return data as CreateSaleAtomicResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useVoidSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleId,
      reason,
    }: {
      saleId: string;
      reason: string;
    }): Promise<SaleRow> => {
      const cleanReason = reason.trim();
      if (!cleanReason) {
        throw new Error('Alasan pembatalan (Void) wajib diisi.');
      }

      const { data, error } = await supabase.rpc('void_sale_atomic', {
        p_sale_id: saleId,
        p_reason: cleanReason,
      });

      if (error) {
        if (error.message.includes('ALASAN_VOID_WAJIB')) {
          throw new Error('Alasan pembatalan (Void) wajib diisi.');
        }
        if (error.message.includes('TRANSAKSI_SUDAH_VOID')) {
          throw new Error('Transaksi ini sudah pernah dibatalkan (Void).');
        }
        throw new Error(error.message);
      }

      return data as SaleRow;
    },
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: SALE_KEYS.detail(sale.id) });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
