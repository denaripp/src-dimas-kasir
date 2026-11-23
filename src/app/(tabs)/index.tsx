import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { useProductsQuery } from '@/hooks/useProducts';
import { usePeriodReportQuery } from '@/hooks/useReports';
import { useSalesHistoryQuery, useSalesRealtime } from '@/hooks/useSales';
import {
  formatIsoDateLocal,
  formatRupiah,
  formatTimeOnly,
  getLocalDayRangeUtc,
} from '@/lib/format';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi!';
  if (hour < 15) return 'Selamat siang!';
  if (hour < 18) return 'Selamat sore!';
  return 'Selamat malam!';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const storeName = store?.name ?? 'Toko Saya';

  useSalesRealtime(store?.id);

  const todayWindow = useMemo(() => {
    const now = new Date();
    const range = getLocalDayRangeUtc(now);
    const localDate = formatIsoDateLocal(now);
    return {
      ...range,
      startDateLocal: localDate,
      endDateLocal: localDate,
    };
  }, []);

  const {
    data: todayReport,
    isRefetching: refetchingReport,
    refetch: refetchReport,
  } = usePeriodReportQuery({
    storeId: store?.id,
    ...todayWindow,
  });

  const {
    data: products = [],
    isRefetching: refetchingProducts,
    refetch: refetchProducts,
  } = useProductsQuery(store?.id);

  const {
    data: recentSales = [],
    isRefetching: refetchingSales,
    refetch: refetchSales,
  } = useSalesHistoryQuery(store?.id, 5);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock <= p.min_stock),
    [products],
  );

  const isRefreshing = refetchingReport || refetchingProducts || refetchingSales;
  const handleRefresh = () => {
    void Promise.all([refetchReport(), refetchProducts(), refetchSales()]);
  };

  const completedCount = todayReport?.completedCount ?? 0;
  const ringCircumference = 2 * Math.PI * 34;
  const progressRatio = Math.min(1, completedCount / 30);
  const strokeDashoffset = ringCircumference * (1 - Math.max(0.08, progressRatio));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <ScrollView
        className="flex-1 bg-white px-[18px]"
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#D91E2A']}
            tintColor="#D91E2A"
          />
        }
      >
        {/* Top Bar */}
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.push('/profil')}
            className="flex-row items-center gap-3"
          >
            {store?.logo_url ? (
              <Image
                source={{ uri: store.logo_url }}
                className="h-[42px] w-[42px] rounded-full border-[1.5px] border-black"
              />
            ) : (
              <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-black">
                <Text className="font-extrabold text-[14px] text-white">
                  {getInitials(storeName)}
                </Text>
              </View>
            )}
            <View>
              <Text className="font-medium text-[11px] text-black">{getGreeting()}</Text>
              <Text className="font-extrabold text-[15px] text-black" numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          </Pressable>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/profil')}
              accessibilityLabel="Profil dan Printer Thermal"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="print" size={15} color="#09090B" solid />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/barang')}
              accessibilityLabel="Notifikasi Stok Menipis"
              className="relative h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="bell" size={15} color="#09090B" solid />
              {lowStockProducts.length > 0 ? (
                <View className="absolute right-2 top-1.5 h-2 w-2 rounded-full border border-white bg-red" />
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Hero Summary Card (Solid Red + White Donut Ring) */}
        <View className="mb-3.5 flex-row items-center justify-between gap-3 rounded-hero bg-red px-5 py-[18px]">
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
                <FontAwesome6 name="rupiah-sign" size={12} color="#D91E2A" solid />
              </View>
              <Text className="font-semibold text-[11.5px] text-white">
                Penjualan Hari Ini
              </Text>
            </View>
            <Text className="font-extrabold text-[22px] tracking-[-0.03em] text-white">
              {formatRupiah(todayReport?.totalSales ?? 0)}
            </Text>
            <Text className="mt-1 font-medium text-[11.5px] text-white">
              Tunai • {completedCount} transaksi selesai
            </Text>
          </View>

          <View className="h-[84px] w-[84px] items-center justify-center">
            <Svg width={84} height={84} viewBox="0 0 84 84">
              <Circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <Circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${ringCircumference}`}
                strokeDashoffset={strokeDashoffset}
                rotation="-90"
                origin="42, 42"
              />
            </Svg>
            <View className="absolute inset-0 items-center justify-center">
              <Text className="font-extrabold text-[18px] text-white">{completedCount}</Text>
              <Text className="font-semibold text-[10px] text-white">struk</Text>
            </View>
          </View>
        </View>

        {/* 2-Column KPI Cards: Laba Kotor & Laba Bersih */}
        <View className="mb-3.5 flex-row gap-3">
          <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
            <View className="mb-3 flex-row items-start justify-between">
              <Text className="font-semibold text-[12.5px] leading-4 text-black">
                {'Laba\nKotor'}
              </Text>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="arrow-trend-up" size={15} color="#FFFFFF" solid />
              </View>
            </View>
            <Text className="font-extrabold text-[17px] text-black">
              {formatRupiah(todayReport?.grossProfit ?? 0)}
            </Text>
            <Text className="mt-0.5 font-medium text-[11px] text-black">hari ini</Text>
          </View>

          <Pressable
            onPress={() => router.push('/keuangan')}
            className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5"
          >
            <View className="mb-3 flex-row items-start justify-between">
              <Text className="font-semibold text-[12.5px] leading-4 text-black">
                {'Laba\nBersih'}
              </Text>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="wallet" size={15} color="#FFFFFF" solid />
              </View>
            </View>
            <Text
              className={`font-extrabold text-[17px] ${
                (todayReport?.netProfit ?? 0) < 0 ? 'text-red' : 'text-black'
              }`}
            >
              {formatRupiah(todayReport?.netProfit ?? 0)}
            </Text>
            <Text className="mt-0.5 font-medium text-[11px] text-black">
              biaya {formatRupiah(todayReport?.totalExpenses ?? 0)}
            </Text>
          </Pressable>
        </View>

        {/* Quick Action CTA to Kasir */}
        <Pressable
          onPress={() => router.push('/(tabs)/kasir')}
          accessibilityRole="button"
          className="mb-4 flex-row items-center justify-center gap-2.5 rounded-control border-[1.5px] border-red bg-red py-3.5"
        >
          <FontAwesome6 name="barcode" size={16} color="#FFFFFF" solid />
          <Text className="font-extrabold text-[14px] text-white">Buka Layar Kasir</Text>
        </Pressable>

        {/* Section: Stok Menipis */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-extrabold text-[13.5px] text-black">
            Stok Menipis ({lowStockProducts.length})
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/barang')}>
            <Text className="font-bold text-[11.5px] text-red">Lihat semua</Text>
          </Pressable>
        </View>

        {lowStockProducts.length === 0 ? (
          <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-3.5">
            <Text className="font-medium text-[12px] text-black">
              Semua stok barang aktif berada di atas batas minimum.
            </Text>
          </View>
        ) : (
          <View className="mb-4 gap-2.5">
            {lowStockProducts.slice(0, 4).map((prod) => (
              <View
                key={prod.id}
                className="flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] border-black bg-white px-3.5 py-3"
              >
                <View className="flex-1">
                  <Text className="font-extrabold text-[14px] text-black" numberOfLines={1}>
                    {prod.name}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <View className="h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-red">
                      <FontAwesome6 name="triangle-exclamation" size={10} color="#FFFFFF" solid />
                    </View>
                    <Text className="font-semibold text-[12px] text-black">
                      Sisa {prod.stock} • Min {prod.min_stock}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <Text className="font-extrabold text-[13.5px] text-black">
                    {formatRupiah(prod.sell_price)}
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/stok/${prod.id}`)}
                    accessibilityLabel={`Tambah stok ${prod.name}`}
                    className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-black bg-white"
                  >
                    <FontAwesome6 name="plus" size={13} color="#09090B" solid />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Section: 5 Transaksi Terakhir */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-extrabold text-[13.5px] text-black">
            5 Transaksi Terakhir
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/riwayat')}>
            <Text className="font-bold text-[11.5px] text-red">Riwayat</Text>
          </Pressable>
        </View>

        {recentSales.length === 0 ? (
          <View className="rounded-card border-[1.5px] border-black bg-white p-3.5">
            <Text className="font-medium text-[12px] text-black">
              Belum ada transaksi tercatat.
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {recentSales.map((sale) => {
              const isVoid = sale.status === 'void';
              const unitCount = (sale.sale_items ?? []).reduce((s, i) => s + i.qty, 0);
              return (
                <Pressable
                  key={sale.id}
                  onPress={() => router.push(`/riwayat/${sale.id}`)}
                  className={`flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] px-3.5 py-3 ${
                    isVoid ? 'border-red bg-red' : 'border-black bg-white'
                  }`}
                >
                  <View className="flex-1">
                    <Text
                      className={`font-extrabold text-[14px] ${
                        isVoid ? 'text-white' : 'text-black'
                      }`}
                    >
                      {sale.receipt_number}
                    </Text>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <View
                        className={`h-[22px] w-[22px] items-center justify-center rounded-[7px] ${
                          isVoid ? 'bg-white' : 'bg-black'
                        }`}
                      >
                        <FontAwesome6
                          name={isVoid ? 'ban' : 'receipt'}
                          size={10}
                          color={isVoid ? '#D91E2A' : '#FFFFFF'}
                          solid
                        />
                      </View>
                      <Text
                        className={`font-medium text-[12px] ${
                          isVoid ? 'text-white' : 'text-black'
                        }`}
                      >
                        {isVoid
                          ? `VOID • ${sale.void_reason ?? 'Dibatalkan'}`
                          : `${unitCount} unit • ${formatTimeOnly(sale.created_at)} • Tunai`}
                      </Text>
                    </View>
                  </View>

                  <Text
                    className={`font-extrabold text-[13.5px] ${
                      isVoid ? 'text-white line-through' : 'text-black'
                    }`}
                  >
                    {formatRupiah(sale.total_amount)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
