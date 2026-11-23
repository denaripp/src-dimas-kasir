import { useQuery } from '@tanstack/react-query';
import {
  computeReportSummary,
  type ReportSummary,
  type SaleWithItems,
} from '@/lib/reportCalc';
import { supabase } from '@/lib/supabase';
import type { ExpenseRow } from '@/types/database';

export interface PeriodReportParams {
  storeId: string | undefined;
  startIso: string;
  endIso: string;
  startDateLocal: string; // YYYY-MM-DD
  endDateLocal: string; // YYYY-MM-DD
}

export function usePeriodReportQuery({
  storeId,
  startIso,
  endIso,
  startDateLocal,
  endDateLocal,
}: PeriodReportParams) {
  return useQuery({
    queryKey: ['reports', storeId, startIso, endIso, startDateLocal, endDateLocal],
    enabled: Boolean(storeId),
    queryFn: async (): Promise<ReportSummary> => {
      const [salesRes, expensesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('*, sale_items(*)')
          .eq('store_id', storeId!)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .eq('store_id', storeId!)
          .gte('expense_date', startDateLocal)
          .lte('expense_date', endDateLocal),
      ]);

      if (salesRes.error) {
        throw new Error(salesRes.error.message);
      }
      if (expensesRes.error) {
        throw new Error(expensesRes.error.message);
      }

      return computeReportSummary(
        (salesRes.data ?? []) as SaleWithItems[],
        (expensesRes.data ?? []) as ExpenseRow[],
      );
    },
  });
}
