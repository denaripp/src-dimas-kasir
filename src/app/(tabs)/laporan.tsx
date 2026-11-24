import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import { SimpleBarChart } from '@/components/laporan/SimpleBarChart';
import { useAuth } from '@/hooks/useAuth';
import { useProductsQuery } from '@/hooks/useProducts';
import { usePeriodReportQuery } from '@/hooks/useReports';
import {
  formatIsoDateLocal,
  formatLocalDateKey,
  formatRupiah,
  getLocalPeriodRangeUtc,
  type ReportPeriod,
} from '@/lib/format';
import { generateReportCsv } from '@/lib/reportCalc';
import { shareCsvFile } from '@/lib/shareFile';

function parseIsoLocalDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return undefined;
  const [y, m, d] = iso.trim().split('-').map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

const PERIOD_OPTIONS: { key: ReportPeriod; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'custom', label: 'Custom' },
];

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  activeSegmentShadow: {
    shadowColor: '#09090B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
});

export default function LaporanScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const { data: products = [] } = useProductsQuery(store?.id);

  const [period, setPeriod] = useState<ReportPeriod>('7d');
  const [draftStartText, setDraftStartText] = useState(() => formatIsoDateLocal());
  const [draftEndText, setDraftEndText] = useState(() => formatIsoDateLocal());
  const [appliedStartText, setAppliedStartText] = useState(() => formatIsoDateLocal());
  const [appliedEndText, setAppliedEndText] = useState(() => formatIsoDateLocal());
  const [isExporting, setIsExporting] = useState(false);

  const dateWindow = useMemo(() => {
    const now = new Date();
    const customStart = parseIsoLocalDate(appliedStartText);
    const customEnd = parseIsoLocalDate(appliedEndText);
    const utcRange = getLocalPeriodRangeUtc(period, customStart, customEnd, now);

    const startDateLocal = formatIsoDateLocal(new Date(utcRange.startIso));
    const endDateLocal = formatIsoDateLocal(new Date(utcRange.endIso));

    const label =
      period === 'today'
        ? 'Hari Ini'
        : period === '7d'
          ? '7 Hari Terakhir'
          : period === 'month'
            ? 'Bulan Ini'
            : `${startDateLocal} s/d ${endDateLocal}`;

    return {
      ...utcRange,
      startDateLocal,
      endDateLocal,
      label,
    };
  }, [period, appliedStartText, appliedEndText]);

  const {
    data: report,
    isLoading,
    isRefetching,
    refetch,
  } = usePeriodReportQuery({
    storeId: store?.id,
    startIso: dateWindow.startIso,
    endIso: dateWindow.endIso,
    startDateLocal: dateWindow.startDateLocal,
    endDateLocal: dateWindow.endDateLocal,
  });

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock <= p.min_stock),
    [products],
  );

  const productImageMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of products) {
      map.set(p.id, p.image_url);
    }
    return map;
  }, [products]);

  const maxTopQty = useMemo(() => {
    const tops = report?.topProducts ?? [];
    if (tops.length === 0) return 1;
    return Math.max(...tops.map((t) => t.totalQty), 1);
  }, [report?.topProducts]);

  const handleApplyCustomRange = () => {
    if (!parseIsoLocalDate(draftStartText) || !parseIsoLocalDate(draftEndText)) {
      Alert.alert(
        'Format Tanggal Salah',
        'Gunakan format YYYY-MM-DD (contoh: 2026-11-24).',
      );
      return;
    }
    setAppliedStartText(draftStartText.trim());
    setAppliedEndText(draftEndText.trim());
  };

  const handleExportReportCsv = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const csv = generateReportCsv(
        store?.name ?? 'Toko Saya',
        dateWindow.label,
        report,
        lowStockProducts,
      );
      const res = await shareCsvFile({
        filename: `laporan-${period}-${formatLocalDateKey()}.csv`,
        content: csv,
        dialogTitle: `Laporan ${dateWindow.label}`,
      });
      if (!res.shared) {
        Alert.alert('Tersimpan', `File laporan CSV disimpan di: ${res.fileUri}`);
      }
    } catch (err) {
      Alert.alert(
        'Gagal Ekspor CSV',
        err instanceof Error ? err.message : 'Tidak dapat mengekspor laporan.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            colors={['#D91E2A']}
            tintColor="#D91E2A"
          />
        }
      >
        {/* Header */}
        <View className="mb-3.5 flex-row items-center justify-between">
          <Text className="font-extrabold text-[20px] tracking-[-0.03em] text-black">
            Laporan
          </Text>
          <View className="flex-row items-center gap-2">
            <MotionPressable
              onPress={() => router.push('/keuangan')}
              accessibilityLabel="Buka Keuangan dan Pengeluaran"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <FontAwesome6 name="wallet" size={14} color="#09090B" solid />
            </MotionPressable>
            <MotionPressable
              onPress={() => void handleExportReportCsv()}
              disabled={isExporting || !report}
              accessibilityLabel="Ekspor Laporan CSV"
              className="h-10 w-10 items-center justify-center rounded-full bg-red"
            >
              <FontAwesome6 name="download" size={14} color="#FFFFFF" solid />
            </MotionPressable>
          </View>
        </View>

        {/* Segmented Period Filter Strip */}
        <View className="mb-3.5 flex-row gap-1 rounded-[13px] bg-surface p-1">
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.key;
            return (
              <MotionPressable
                key={opt.key}
                wrapperClassName="flex-1"
                onPress={() => setPeriod(opt.key)}
                scaleTo={0.97}
                className={`items-center rounded-[9px] py-2 ${active ? 'bg-white' : ''}`}
                style={active ? styles.activeSegmentShadow : undefined}
              >
                <Text
                  className={`font-bold text-[11px] ${active ? 'text-black' : 'text-muted'}`}
                >
                  {opt.label}
                </Text>
              </MotionPressable>
            );
          })}
        </View>

        {/* Custom Date Range Inputs (Apply explicitly to avoid per-keystroke RPC) */}
        {period === 'custom' ? (
          <View className="mb-3.5 gap-2">
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1 font-bold text-[11px] text-muted">Dari (YYYY-MM-DD)</Text>
                <TextInput
                  value={draftStartText}
                  onChangeText={setDraftStartText}
                  placeholder="2026-11-01"
                  placeholderTextColor="#71717A"
                  className="rounded-control bg-surface px-3 py-2.5 font-semibold text-[12.5px] text-black"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 font-bold text-[11px] text-muted">Sampai (YYYY-MM-DD)</Text>
                <TextInput
                  value={draftEndText}
                  onChangeText={setDraftEndText}
                  placeholder="2026-11-24"
                  placeholderTextColor="#71717A"
                  className="rounded-control bg-surface px-3 py-2.5 font-semibold text-[12.5px] text-black"
                />
              </View>
            </View>
            <MotionPressable
              onPress={handleApplyCustomRange}
              className="items-center rounded-control bg-black py-2.5"
            >
              <Text className="font-bold text-[12px] text-white">Terapkan Rentang</Text>
            </MotionPressable>
          </View>
        ) : null}

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#D91E2A" />
          </View>
        ) : (
          <>
            {/* Main Sales Chart Card */}
            <View className="mb-3.5 rounded-card border border-border bg-white p-4">
              <View className="flex-row items-baseline justify-between gap-2">
                <Text className="font-semibold text-[12px] text-muted" numberOfLines={1}>
                  Total Penjualan · {dateWindow.label}
                </Text>
                <Text
                  className="font-semibold text-[11.5px] text-muted"
                  style={styles.tabular}
                >
                  Biaya{' '}
                  <Text className="font-extrabold text-red">
                    {formatRupiah(report?.totalExpenses ?? 0)}
                  </Text>
                </Text>
              </View>

              <Text
                className="mt-1 font-extrabold text-[25px] tracking-[-0.03em] text-black"
                style={styles.tabular}
              >
                {formatRupiah(report?.totalSales ?? 0)}
              </Text>

              <View className="mt-4">
                <SimpleBarChart series={report?.dailySeries ?? []} />
              </View>
            </View>

            {/* 2x2 Soft KPI Grid */}
            <View className="mb-2.5 flex-row gap-2.5">
              <View className="flex-1 rounded-card bg-surface p-3.5">
                <Text className="font-semibold text-[11.5px] text-muted">Laba Kotor</Text>
                <Text
                  className="mt-1.5 font-extrabold text-[17px] text-black"
                  style={styles.tabular}
                >
                  {formatRupiah(report?.grossProfit ?? 0)}
                </Text>
              </View>

              <MotionPressable
                wrapperClassName="flex-1"
                onPress={() => router.push('/keuangan')}
                className="rounded-card bg-surface p-3.5"
              >
                <Text className="font-semibold text-[11.5px] text-muted">Laba Bersih</Text>
                <Text
                  className={`mt-1.5 font-extrabold text-[17px] ${
                    (report?.netProfit ?? 0) < 0 ? 'text-red' : 'text-black'
                  }`}
                  style={styles.tabular}
                >
                  {formatRupiah(report?.netProfit ?? 0)}
                </Text>
              </MotionPressable>
            </View>

            <View className="mb-4 flex-row gap-2.5">
              <View className="flex-1 rounded-card bg-surface p-3.5">
                <Text className="font-semibold text-[11.5px] text-muted">Transaksi Selesai</Text>
                <Text
                  className="mt-1.5 font-extrabold text-[17px] text-black"
                  style={styles.tabular}
                >
                  {report?.completedCount ?? 0}
                </Text>
              </View>

              <MotionPressable
                wrapperClassName="flex-1"
                onPress={() => router.push('/(tabs)/barang')}
                className="rounded-card bg-surface p-3.5"
              >
                <Text className="font-semibold text-[11.5px] text-muted">Stok Menipis</Text>
                <Text
                  className={`mt-1.5 font-extrabold text-[17px] ${
                    lowStockProducts.length > 0 ? 'text-red' : 'text-black'
                  }`}
                  style={styles.tabular}
                >
                  {lowStockProducts.length}{' '}
                  <Text className="font-semibold text-[11.5px] text-muted">barang</Text>
                </Text>
              </MotionPressable>
            </View>

            {/* Top 5 Barang Terlaris */}
            <View className="mb-2.5 flex-row items-center justify-between">
              <Text className="font-extrabold text-[14px] text-black">
                Top 5 Barang Terlaris
              </Text>
              <Text className="font-semibold text-[11.5px] text-muted">Berdasarkan unit</Text>
            </View>

            <View className="mb-4 overflow-hidden rounded-card border border-border bg-white">
              {(report?.topProducts.length ?? 0) === 0 ? (
                <View className="p-4">
                  <Text className="font-medium text-[12px] text-muted">
                    Belum ada penjualan barang pada periode ini.
                  </Text>
                </View>
              ) : (
                report!.topProducts.map((item, idx) => {
                  const isLast = idx === report!.topProducts.length - 1;
                  const pct = Math.max(8, Math.round((item.totalQty / maxTopQty) * 100));
                  const thumbUrl = productImageMap.get(item.productId) ?? null;

                  return (
                    <View
                      key={item.productId}
                      className={`flex-row items-center gap-3 px-3.5 py-3 ${
                        !isLast ? 'border-b border-border' : ''
                      }`}
                    >
                      <ProductThumbnail imageUrl={thumbUrl} size={38} iconSize={14} />

                      <View className="flex-1">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text
                            className="flex-1 font-bold text-[13px] text-black"
                            numberOfLines={1}
                          >
                            {idx + 1}. {item.name}
                          </Text>
                          <Text
                            className="font-extrabold text-[12.5px] text-black"
                            style={styles.tabular}
                          >
                            {item.totalQty} unit
                          </Text>
                        </View>

                        <View className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-surface">
                          <View
                            className="h-full rounded-full bg-red"
                            style={{
                              width: `${pct}%`,
                              opacity: idx === 0 ? 1 : 0.45,
                            }}
                          />
                        </View>

                        <Text
                          className="mt-1 font-medium text-[11px] text-muted"
                          style={styles.tabular}
                        >
                          Omzet {formatRupiah(item.totalRevenue)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Peringatan Stok Menipis */}
            {lowStockProducts.length > 0 ? (
              <>
                <Text className="mb-2.5 font-extrabold text-[14px] text-black">
                  Peringatan Stok Menipis ({lowStockProducts.length})
                </Text>
                <View className="mb-4 overflow-hidden rounded-card border border-border bg-white">
                  {lowStockProducts.slice(0, 6).map((prod, idx) => {
                    const isLast = idx === Math.min(lowStockProducts.length, 6) - 1;
                    return (
                      <MotionPressable
                        key={prod.id}
                        onPress={() => router.push(`/stok/${prod.id}`)}
                        scaleTo={0.985}
                        className={`flex-row items-center justify-between bg-white px-3.5 py-3 ${
                          !isLast ? 'border-b border-border' : ''
                        }`}
                      >
                        <Text
                          className="flex-1 pr-2 font-bold text-[13px] text-black"
                          numberOfLines={1}
                        >
                          {prod.name}
                        </Text>
                        <View className="rounded-[7px] bg-red-soft px-2 py-0.5">
                          <Text
                            className="font-bold text-[11px] text-red"
                            style={styles.tabular}
                          >
                            Sisa {prod.stock} / Min {prod.min_stock}
                          </Text>
                        </View>
                      </MotionPressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Shortcut Kelola Pengeluaran */}
            <MotionPressable
              onPress={() => router.push('/keuangan')}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
            >
              <FontAwesome6 name="wallet" size={13} color="#09090B" solid />
              <Text className="font-bold text-[13px] text-black">
                Kelola Pengeluaran &amp; Biaya
              </Text>
            </MotionPressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
