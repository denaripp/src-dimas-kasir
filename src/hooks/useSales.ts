import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRODUCT_KEYS } from '@/hooks/useProducts';
import { parseSaleRpcError } from '@/lib/cartCalc';
import { formatLocalDateKey } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CreateSaleAtomicResult, CreateSaleItemInput } from '@/types/database';

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
