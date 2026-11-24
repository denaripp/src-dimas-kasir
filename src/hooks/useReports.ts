import { useQuery } from '@tanstack/react-query';
import { toUserFriendlyError } from '@/lib/errorMessage';
import type { DailySalesPoint, ReportSummary, TopProductItem } from '@/lib/reportCalc';
import { supabase } from '@/lib/supabase';

export interface PeriodReportParams {
  storeId: string | undefined;
  startIso: string;
  endIso: string;
  startDateLocal: string; // YYYY-MM-DD
  endDateLocal: string; // YYYY-MM-DD
}

interface RawReportRpcPayload {
  totalSales?: number | string;
  completedCount?: number | string;
  voidCount?: number | string;
  grossProfit?: number | string;
  totalExpenses?: number | string;
  netProfit?: number | string;
  topProducts?: {
    productId: string;
    name: string;
    totalQty: number | string;
    totalRevenue: number | string;
  }[];
  dailySeries?: {
    dateKey: string;
    label: string;
    totalSales: number | string;
    txCount: number | string;
  }[];
}

function normalizeReportPayload(raw: RawReportRpcPayload | null): ReportSummary {
  const topProducts: TopProductItem[] = (raw?.topProducts ?? []).map((p) => ({
    productId: p.productId,
    name: p.name,
    totalQty: Number(p.totalQty) || 0,
    totalRevenue: Number(p.totalRevenue) || 0,
  }));

  const dailySeries: DailySalesPoint[] = (raw?.dailySeries ?? []).map((d) => ({
    dateKey: d.dateKey,
    label: d.label,
    totalSales: Number(d.totalSales) || 0,
    txCount: Number(d.txCount) || 0,
  }));

  return {
    totalSales: Number(raw?.totalSales) || 0,
    completedCount: Number(raw?.completedCount) || 0,
    voidCount: Number(raw?.voidCount) || 0,
    grossProfit: Number(raw?.grossProfit) || 0,
    totalExpenses: Number(raw?.totalExpenses) || 0,
    netProfit: Number(raw?.netProfit) || 0,
    topProducts,
    dailySeries,
  };
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
    staleTime: 60_000,
    queryFn: async (): Promise<ReportSummary> => {
      const tzOffsetMinutes = -new Date().getTimezoneOffset();

      const { data, error } = await supabase.rpc('get_period_report_summary', {
        p_start_iso: startIso,
        p_end_iso: endIso,
        p_start_date: startDateLocal,
        p_end_date: endDateLocal,
        p_tz_offset_minutes: tzOffsetMinutes,
      });

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memuat ringkasan laporan.'));
      }

      return normalizeReportPayload((data as RawReportRpcPayload | null) ?? null);
    },
  });
}
