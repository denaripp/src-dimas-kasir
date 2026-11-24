import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { PRODUCT_KEYS } from '@/hooks/useProducts';
import { parseSaleRpcError } from '@/lib/cartCalc';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { formatLocalDateKey } from '@/lib/format';
import type { SaleWithItems } from '@/lib/reportCalc';
import { supabase } from '@/lib/supabase';
import type {
  CreateSaleAtomicResult,
  CreateSaleItemInput,
  ProductRow,
  SaleRow,
} from '@/types/database';

export const SALE_KEYS = {
  all: ['sales'] as const,
  list: (storeId: string | undefined) => ['sales', 'list', storeId] as const,
  detail: (saleId: string | undefined) => ['sales', 'detail', saleId] as const,
};

const SALES_HISTORY_FETCH_LIMIT = 100;
const SELF_ECHO_TTL_MS = 5_000;
const REALTIME_DEBOUNCE_MS = 600;

const recentlyMutatedSaleIds = new Map<string, number>();

function markSaleMutatedLocally(saleId: string): void {
  const now = Date.now();
  recentlyMutatedSaleIds.set(saleId, now + SELF_ECHO_TTL_MS);

  // Bersihkan entri kedaluwarsa agar Map tetap kecil
  for (const [id, expiresAt] of recentlyMutatedSaleIds.entries()) {
    if (expiresAt <= now) {
      recentlyMutatedSaleIds.delete(id);
    }
  }
}

function isSelfMutatedSaleEcho(saleId: unknown): boolean {
  if (typeof saleId !== 'string' || !saleId) {
    return false;
  }
  const expiresAt = recentlyMutatedSaleIds.get(saleId);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt <= Date.now()) {
    recentlyMutatedSaleIds.delete(saleId);
    return false;
  }
  return true;
}

export interface CreateSaleInput {
  cashReceived: number;
  items: CreateSaleItemInput[];
  localDate?: string;
}

/**
 * Mengambil riwayat transaksi dengan 1 cache bersama per storeId.
 * Parameter `limit` hanya memotong slice melalui `select` sehingga Beranda (5)
 * dan Riwayat (100) berbagi cache yang sama tanpa menembak 2 query paralel.
 */
export function useSalesHistoryQuery(storeId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: SALE_KEYS.list(storeId),
    enabled: Boolean(storeId),
    staleTime: 60_000,
    queryFn: async (): Promise<SaleWithItems[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false })
        .limit(SALES_HISTORY_FETCH_LIMIT);

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memuat riwayat transaksi.'));
      }
      return (data ?? []) as SaleWithItems[];
    },
    select: (rows) =>
      typeof limit === 'number' && limit > 0 && limit < rows.length
        ? rows.slice(0, limit)
        : rows,
  });
}

export function useSaleDetailQuery(saleId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: SALE_KEYS.detail(saleId),
    enabled: Boolean(saleId),
    staleTime: 60_000,
    initialData: () => {
      if (!saleId) return undefined;
      const lists = queryClient.getQueriesData<SaleWithItems[]>({
        queryKey: ['sales', 'list'],
      });
      for (const [, rows] of lists) {
        const found = rows?.find((row) => row.id === saleId);
        if (found) return found;
      }
      return undefined;
    },
    queryFn: async (): Promise<SaleWithItems | null> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', saleId!)
        .maybeSingle();

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memuat detail struk.'));
      }
      return (data as SaleWithItems | null) ?? null;
    },
  });
}

/**
 * Langganan Supabase Realtime pada tabel sales (PRD 3.12):
 * - Mengabaikan echo dari transaksi/void yang baru saja dibuat perangkat ini sendiri
 *   (mencegah double refetch storm pasca checkout).
 * - Men-debounce pembaruan dari perangkat lain selama 600ms.
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
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidation = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
        void queryClient.invalidateQueries({ queryKey: ['reports'] });
        void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      }, REALTIME_DEBOUNCE_MS);
    };

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
          (payload) => {
            const changedId =
              (payload.new as { id?: unknown } | null)?.id ??
              (payload.old as { id?: unknown } | null)?.id;

            if (isSelfMutatedSaleEcho(changedId)) {
              return;
            }
            scheduleInvalidation();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime subscribe gagal:', err);
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
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
    onSuccess: (result) => {
      markSaleMutatedLocally(result.sale.id);

      // Optimistic stock update agar tampilan Kasir/Barang langsung akurat sebelum refetch selesai
      const qtyByProductId = new Map<string, number>();
      for (const item of result.items) {
        qtyByProductId.set(
          item.product_id,
          (qtyByProductId.get(item.product_id) ?? 0) + item.qty,
        );
      }
      if (qtyByProductId.size > 0) {
        queryClient.setQueriesData<ProductRow[]>(
          { queryKey: ['products', 'list'] },
          (prev) =>
            prev?.map((p) => {
              const sold = qtyByProductId.get(p.id);
              return sold ? { ...p, stock: Math.max(0, p.stock - sold) } : p;
            }),
        );
      }

      void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
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
        throw new Error(toUserFriendlyError(error, 'Gagal membatalkan transaksi.'));
      }

      return data as SaleRow;
    },
    onSuccess: (sale) => {
      markSaleMutatedLocally(sale.id);
      void queryClient.invalidateQueries({ queryKey: SALE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
