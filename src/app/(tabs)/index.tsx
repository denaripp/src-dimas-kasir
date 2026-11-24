import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import { useAuth } from '@/hooks/useAuth';
import { useProductsQuery } from '@/hooks/useProducts';
import { usePeriodReportQuery } from '@/hooks/useReports';
import { useSalesHistoryQuery } from '@/hooks/useSales';
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
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const storeName = store?.name ?? 'Toko Saya';

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
  const totalExpenses = todayReport?.totalExpenses ?? 0;

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
        {/* Top Bar: Profil Toko di Kiri, Notifikasi Stok di Kanan */}
        <View className="mb-4 flex-row items-center justify-between">
          <MotionPressable
            onPress={() => router.push('/profil')}
            scaleTo={0.97}
            className="flex-row items-center gap-3"
          >
            {store?.logo_url ? (
              <Image
                source={{ uri: store.logo_url }}
                className="h-10 w-10 rounded-[13px] border border-border"
              />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-[13px] bg-black">
                <Text className="font-extrabold text-[13.5px] text-white">
                  {getInitials(storeName)}
                </Text>
              </View>
            )}
            <View>
              <Text className="font-semibold text-[11.5px] text-muted">{getGreeting()}</Text>
              <Text
                className="max-w-[200px] font-extrabold text-[15.5px] tracking-[-0.02em] text-black"
                numberOfLines={1}
              >
                {storeName}
              </Text>
            </View>
          </MotionPressable>

          <MotionPressable
            onPress={() => router.push('/(tabs)/barang')}
            accessibilityLabel="Notifikasi Stok Menipis"
            className="relative h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="bell" size={15} color="#09090B" solid />
            {lowStockProducts.length > 0 ? (
              <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red px-1 py-0.5">
                <Text className="font-extrabold text-[9px] text-white">
                  {lowStockProducts.length > 99 ? '99+' : lowStockProducts.length}
                </Text>
              </View>
            ) : null}
          </MotionPressable>
        </View>

        {/* Unified Red Hero Summary Card */}
        <View
          className="rounded-hero bg-red p-5"
          style={{
            shadowColor: '#D91E2A',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
            elevation: 5,
          }}
        >
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-semibold text-[12px] text-white/90">
                Penjualan Hari Ini
              </Text>
              <Text
                className="mt-1 font-extrabold text-[27px] tracking-[-0.03em] text-white"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatRupiah(todayReport?.totalSales ?? 0)}
              </Text>
            </View>
            <View className="rounded-chip bg-white/15 px-2.5 py-1.5">
              <Text
                className="font-bold text-[11.5px] text-white"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {completedCount} struk
              </Text>
            </View>
          </View>

          <View className="my-3.5 h-[1px] bg-white/20" />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="font-semibold text-[11px] text-white/85">Laba Kotor</Text>
              <Text
                className="mt-0.5 font-extrabold text-[15px] text-white"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {formatRupiah(todayReport?.grossProfit ?? 0)}
              </Text>
            </View>

            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => router.push('/keuangan')}
              scaleTo={0.97}
            >
              <Text className="font-semibold text-[11px] text-white/85" numberOfLines={1}>
                Laba Bersih · -{formatRupiah(totalExpenses)}
              </Text>
              <Text
                className="mt-0.5 font-extrabold text-[15px] text-white"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {formatRupiah(todayReport?.netProfit ?? 0)}
              </Text>
            </MotionPressable>
          </View>
        </View>

        {/* 3-Column Quick Actions: Catat Biaya, Tambah Barang, Printer */}
        <View className="mb-5 mt-3.5 flex-row gap-2">
          <MotionPressable
            wrapperClassName="flex-1"
            onPress={() => router.push('/keuangan')}
            className="items-center gap-2 rounded-2xl bg-surface px-2 py-3"
          >
            <View className="h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-border bg-white">
              <FontAwesome6 name="wallet" size={14} color="#09090B" solid />
            </View>
            <Text className="font-bold text-[11.5px] text-black" numberOfLines={1}>
              Catat Biaya
            </Text>
          </MotionPressable>

          <MotionPressable
            wrapperClassName="flex-1"
            onPress={() => router.push('/barang/new')}
            className="items-center gap-2 rounded-2xl bg-surface px-2 py-3"
          >
            <View className="h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-border bg-white">
              <FontAwesome6 name="plus" size={14} color="#09090B" solid />
            </View>
            <Text className="font-bold text-[11.5px] text-black" numberOfLines={1}>
              Tambah Barang
            </Text>
          </MotionPressable>

          <MotionPressable
            wrapperClassName="flex-1"
            onPress={() => router.push('/profil')}
            className="items-center gap-2 rounded-2xl bg-surface px-2 py-3"
          >
            <View className="h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-border bg-white">
              <FontAwesome6 name="print" size={14} color="#09090B" solid />
            </View>
            <Text className="font-bold text-[11.5px] text-black" numberOfLines={1}>
              Printer
            </Text>
          </MotionPressable>
        </View>

        {/* Section: Stok Menipis (Grouped Hairline Card) */}
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="font-extrabold text-[14px] text-black">
            Stok Menipis ({lowStockProducts.length})
          </Text>
          <MotionPressable onPress={() => router.push('/(tabs)/barang')} scaleTo={0.95}>
            <Text className="font-bold text-[12px] text-red">Lihat semua</Text>
          </MotionPressable>
        </View>

        {lowStockProducts.length === 0 ? (
          <View className="mb-5 rounded-card border border-border bg-white p-4">
            <Text className="font-medium text-[12.5px] text-muted">
              Semua stok barang aktif berada di atas batas minimum.
            </Text>
          </View>
        ) : (
          <View className="mb-5 overflow-hidden rounded-card border border-border bg-white">
            {lowStockProducts.slice(0, 4).map((prod, idx) => {
              const isLast = idx === Math.min(lowStockProducts.length, 4) - 1;
              return (
                <View
                  key={prod.id}
                  className={`flex-row items-center gap-3 px-3.5 py-3 ${
                    !isLast ? 'border-b border-border' : ''
                  }`}
                >
                  <ProductThumbnail imageUrl={prod.image_url} size={42} iconSize={15} />
                  <View className="flex-1">
                    <Text className="font-bold text-[13.5px] text-black" numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <View className="rounded-[7px] bg-red-soft px-2 py-0.5">
                        <Text
                          className="font-bold text-[10.5px] text-red"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          Sisa {prod.stock}
                        </Text>
                      </View>
                      <Text
                        className="font-medium text-[11.5px] text-muted"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        Min {prod.min_stock}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Text
                      className="font-extrabold text-[13px] text-black"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatRupiah(prod.sell_price)}
                    </Text>
                    <MotionPressable
                      onPress={() => router.push(`/stok/${prod.id}`)}
                      accessibilityLabel={`Tambah stok ${prod.name}`}
                      className="h-[34px] w-[34px] items-center justify-center rounded-full bg-surface"
                    >
                      <FontAwesome6 name="plus" size={12} color="#09090B" solid />
                    </MotionPressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Section: 5 Transaksi Terakhir (Grouped Hairline Card) */}
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="font-extrabold text-[14px] text-black">
            5 Transaksi Terakhir
          </Text>
          <MotionPressable onPress={() => router.push('/(tabs)/riwayat')} scaleTo={0.95}>
            <Text className="font-bold text-[12px] text-red">Riwayat</Text>
          </MotionPressable>
        </View>

        {recentSales.length === 0 ? (
          <View className="rounded-card border border-border bg-white p-4">
            <Text className="font-medium text-[12.5px] text-muted">
              Belum ada transaksi tercatat.
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-card border border-border bg-white">
            {recentSales.map((sale, idx) => {
              const isVoid = sale.status === 'void';
              const isLast = idx === recentSales.length - 1;
              const unitCount = (sale.sale_items ?? []).reduce((s, i) => s + i.qty, 0);
              return (
                <MotionPressable
                  key={sale.id}
                  onPress={() => router.push(`/riwayat/${sale.id}`)}
                  scaleTo={0.985}
                  className={`flex-row items-center gap-3 bg-white px-3.5 py-3 ${
                    !isLast ? 'border-b border-border' : ''
                  }`}
                >
                  <View
                    className={`h-[34px] w-[34px] items-center justify-center rounded-[11px] ${
                      isVoid ? 'bg-red-soft' : 'bg-surface'
                    }`}
                  >
                    <FontAwesome6
                      name={isVoid ? 'ban' : 'receipt'}
                      size={13}
                      color={isVoid ? '#D91E2A' : '#09090B'}
                      solid
                    />
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className="font-bold text-[13.5px] text-black"
                        style={{ fontVariant: ['tabular-nums'] }}
                        numberOfLines={1}
                      >
                        {sale.receipt_number}
                      </Text>
                      {isVoid ? (
                        <View className="rounded-[6px] bg-red-soft px-1.5 py-0.5">
                          <Text className="font-extrabold text-[9.5px] text-red">VOID</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="mt-0.5 font-medium text-[11.5px] text-muted" numberOfLines={1}>
                      {isVoid
                        ? sale.void_reason ?? 'Dibatalkan'
                        : `${unitCount} unit • ${formatTimeOnly(sale.created_at)} • Tunai`}
                    </Text>
                  </View>

                  <Text
                    className={`font-extrabold text-[13.5px] ${
                      isVoid ? 'text-muted line-through' : 'text-black'
                    }`}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatRupiah(sale.total_amount)}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
