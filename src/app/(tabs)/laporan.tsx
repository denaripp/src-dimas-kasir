import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function LaporanScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const { data: products = [] } = useProductsQuery(store?.id);

  const [period, setPeriod] = useState<ReportPeriod>('7d');
  const [customStartText, setCustomStartText] = useState(() => formatIsoDateLocal());
  const [customEndText, setCustomEndText] = useState(() => formatIsoDateLocal());
  const [isExporting, setIsExporting] = useState(false);

  const dateWindow = useMemo(() => {
    const now = new Date();
    const customStart = parseIsoLocalDate(customStartText);
    const customEnd = parseIsoLocalDate(customEndText);
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
  }, [period, customStartText, customEndText]);

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

  const chartData = useMemo(() => {
    const series = report?.dailySeries ?? [];
    if (series.length === 0) return [];
    const maxVal = Math.max(...series.map((s) => s.totalSales), 1);

    return series.slice(-7).map((point) => {
      const isPeak = point.totalSales === maxVal && point.totalSales > 0;
      return {
        value: point.totalSales,
        label: point.label.split(' ')[0],
        frontColor: isPeak ? '#D91E2A' : '#09090B',
        topLabelComponent: () => (
          <Text
            className={`mb-1 font-extrabold text-[9px] ${
              isPeak ? 'text-red' : 'text-black'
            }`}
          >
            {point.totalSales >= 1000
              ? `${Math.round(point.totalSales / 1000)}rb`
              : `${point.totalSales}`}
          </Text>
        ),
      };
    });
  }, [report?.dailySeries]);

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
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) {
        throw new Error('Direktori penyimpanan sementara tidak tersedia.');
      }
      const fileUri = `${dir}laporan-${period}-${formatLocalDateKey()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Tersimpan', `File laporan CSV disimpan di: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Laporan ${dateWindow.label}`,
      });
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
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
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
          <Text className="font-extrabold text-[18px] text-black">Laporan Usaha</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/keuangan')}
              accessibilityLabel="Buka Keuangan dan Pengeluaran"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="wallet" size={14} color="#09090B" solid />
            </Pressable>
            <Pressable
              onPress={() => router.push('/profil')}
              accessibilityLabel="Buka Profil Toko"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="store" size={14} color="#09090B" solid />
            </Pressable>
            <Pressable
              onPress={() => void handleExportReportCsv()}
              disabled={isExporting || !report}
              accessibilityLabel="Ekspor Laporan CSV"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-red bg-red"
            >
              <FontAwesome6 name="download" size={14} color="#FFFFFF" solid />
            </Pressable>
          </View>
        </View>

        {/* Period Filter Strip */}
        <View className="mb-3 flex-row gap-1.5">
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setPeriod(opt.key)}
                className={`flex-1 items-center rounded-chip border-[1.5px] py-2 ${
                  active ? 'border-red bg-red' : 'border-black bg-white'
                }`}
              >
                <Text
                  className={`font-extrabold text-[11px] ${
                    active ? 'text-white' : 'text-black'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom Date Range Inputs */}
        {period === 'custom' ? (
          <View className="mb-3 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-black">Dari (YYYY-MM-DD)</Text>
              <TextInput
                value={customStartText}
                onChangeText={setCustomStartText}
                placeholder="2026-11-01"
                placeholderTextColor="#09090B"
                className="rounded-chip border-[1.5px] border-black bg-white px-3 py-2 font-semibold text-[12.5px] text-black"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-black">Sampai (YYYY-MM-DD)</Text>
              <TextInput
                value={customEndText}
                onChangeText={setCustomEndText}
                placeholder="2026-11-23"
                placeholderTextColor="#09090B"
                className="rounded-chip border-[1.5px] border-black bg-white px-3 py-2 font-semibold text-[12.5px] text-black"
              />
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#D91E2A" />
          </View>
        ) : (
          <>
            {/* Main Sales Chart Card */}
            <View className="mb-3.5 rounded-hero border-[1.5px] border-black bg-white p-4">
              <Text className="font-semibold text-[12px] text-black">
                Total Penjualan ({dateWindow.label})
              </Text>
              <View className="mt-1 flex-row items-baseline justify-between gap-2">
                <Text className="font-extrabold text-[23px] tracking-[-0.03em] text-black">
                  {formatRupiah(report?.totalSales ?? 0)}
                </Text>
                <Text className="font-semibold text-[11px] text-black">
                  Biaya:{' '}
                  <Text className="font-extrabold text-red">
                    {formatRupiah(report?.totalExpenses ?? 0)}
                  </Text>
                </Text>
              </View>

              <View className="mt-4 items-center overflow-hidden">
                {chartData.length > 0 ? (
                  <BarChart
                    data={chartData}
                    barWidth={24}
                    spacing={14}
                    roundedTop
                    showGradient={false}
                    hideRules
                    yAxisThickness={0}
                    xAxisThickness={1.5}
                    xAxisColor="#09090B"
                    hideYAxisText
                    height={130}
                    noOfSections={3}
                    isAnimated={false}
                    xAxisLabelTextStyle={{
                      color: '#09090B',
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  />
                ) : (
                  <View className="w-full items-center rounded-control border-[1.5px] border-dashed border-black py-7">
                    <Text className="font-semibold text-[12px] text-black">
                      Belum ada grafik penjualan pada periode ini.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 2x2 KPI Grid */}
            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-red">
                    <FontAwesome6 name="arrow-trend-up" size={13} color="#FFFFFF" solid />
                  </View>
                  <Text className="font-extrabold text-[12px] text-black">Laba Kotor</Text>
                </View>
                <Text className="font-extrabold text-[16.5px] text-black">
                  {formatRupiah(report?.grossProfit ?? 0)}
                </Text>
              </View>

              <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-red">
                    <FontAwesome6 name="wallet" size={13} color="#FFFFFF" solid />
                  </View>
                  <Text className="font-extrabold text-[12px] text-black">Laba Bersih</Text>
                </View>
                <Text
                  className={`font-extrabold text-[16.5px] ${
                    (report?.netProfit ?? 0) < 0 ? 'text-red' : 'text-black'
                  }`}
                >
                  {formatRupiah(report?.netProfit ?? 0)}
                </Text>
              </View>
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-red">
                    <FontAwesome6 name="receipt" size={13} color="#FFFFFF" solid />
                  </View>
                  <Text className="font-extrabold text-[12px] text-black">Transaksi</Text>
                </View>
                <Text className="font-extrabold text-[16.5px] text-black">
                  {report?.completedCount ?? 0}{' '}
                  <Text className="font-medium text-[11px]">selesai</Text>
                </Text>
              </View>

              <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-red">
                    <FontAwesome6 name="box-open" size={13} color="#FFFFFF" solid />
                  </View>
                  <Text className="font-extrabold text-[12px] text-black">Stok Menipis</Text>
                </View>
                <Text className="font-extrabold text-[16.5px] text-black">
                  {lowStockProducts.length}{' '}
                  <Text className="font-medium text-[11px]">barang</Text>
                </Text>
              </View>
            </View>

            {/* Top 5 Barang Terlaris */}
            <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
              <View className="mb-2.5 flex-row items-center gap-2">
                <FontAwesome6 name="trophy" size={14} color="#D91E2A" solid />
                <Text className="font-extrabold text-[14px] text-black">
                  Top 5 Barang Terlaris (Unit)
                </Text>
              </View>

              {(report?.topProducts.length ?? 0) === 0 ? (
                <Text className="font-medium text-[12px] text-black">
                  Belum ada penjualan barang pada periode ini.
                </Text>
              ) : (
                <View className="gap-2">
                  {report!.topProducts.map((item, idx) => (
                    <View
                      key={item.productId}
                      className="flex-row items-center justify-between border-b border-dashed border-black pb-2 last:border-b-0 last:pb-0"
                    >
                      <View className="flex-1 flex-row items-center gap-2.5 pr-2">
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full ${
                            idx === 0 ? 'bg-red' : 'bg-black'
                          }`}
                        >
                          <Text className="font-extrabold text-[11px] text-white">
                            {idx + 1}
                          </Text>
                        </View>
                        <Text
                          className="flex-1 font-bold text-[13px] text-black"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-extrabold text-[13px] text-black">
                          {item.totalQty} unit
                        </Text>
                        <Text className="font-medium text-[11px] text-black">
                          {formatRupiah(item.totalRevenue)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Daftar Stok Menipis */}
            {lowStockProducts.length > 0 ? (
              <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
                <Text className="mb-2.5 font-extrabold text-[14px] text-black">
                  Peringatan Stok Menipis ({lowStockProducts.length})
                </Text>
                <View className="gap-2">
                  {lowStockProducts.slice(0, 6).map((prod) => (
                    <Pressable
                      key={prod.id}
                      onPress={() => router.push(`/stok/${prod.id}`)}
                      className="flex-row items-center justify-between border-b border-dashed border-black pb-2 last:border-b-0 last:pb-0"
                    >
                      <Text className="flex-1 font-bold text-[13px] text-black" numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <Text className="font-extrabold text-[12.5px] text-red">
                        Sisa {prod.stock} / Min {prod.min_stock}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Shortcut Keuangan & Profil */}
            <View className="flex-row gap-2.5">
              <Pressable
                onPress={() => router.push('/keuangan')}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <FontAwesome6 name="wallet" size={13} color="#09090B" solid />
                <Text className="font-extrabold text-[12.5px] text-black">Pengeluaran</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/profil')}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <FontAwesome6 name="store" size={13} color="#09090B" solid />
                <Text className="font-extrabold text-[12.5px] text-black">Profil &amp; Printer</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
