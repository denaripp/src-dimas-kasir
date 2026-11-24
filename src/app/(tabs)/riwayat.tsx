import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useAuth } from '@/hooks/useAuth';
import { useSalesHistoryQuery } from '@/hooks/useSales';
import { formatDateTime, formatRupiah, formatTimeOnly } from '@/lib/format';
import type { SaleWithItems } from '@/lib/reportCalc';

type HistoryFilter = 'all' | 'completed' | 'void';

export default function RiwayatScreen() {
  const router = useRouter();
  const { store } = useAuth();

  const {
    data: sales = [],
    isLoading,
    isRefetching,
    refetch,
  } = useSalesHistoryQuery(store?.id, 100);

  const [filter, setFilter] = useState<HistoryFilter>('all');

  const filteredSales = useMemo(() => {
    if (filter === 'all') return sales;
    return sales.filter((s) => s.status === filter);
  }, [sales, filter]);

  const renderItem = ({ item, index }: { item: SaleWithItems; index: number }) => {
    const isVoid = item.status === 'void';
    const isFirst = index === 0;
    const isLast = index === filteredSales.length - 1;
    const totalUnits = (item.sale_items ?? []).reduce((sum, si) => sum + si.qty, 0);
    const firstItemName = item.sale_items?.[0]?.product_name_snapshot;
    const itemSummary =
      (item.sale_items?.length ?? 0) > 1
        ? `${firstItemName} +${item.sale_items.length - 1} lainnya`
        : firstItemName ?? `${totalUnits} item`;

    return (
      <MotionPressable
        onPress={() => router.push(`/riwayat/${item.id}`)}
        scaleTo={0.985}
        className={`flex-row items-center gap-3 border-x border-border bg-white px-3.5 py-3 ${
          isFirst ? 'rounded-t-card border-t' : ''
        } ${isLast ? 'rounded-b-card border-b' : 'border-b border-border'}`}
      >
        <View
          className={`h-[36px] w-[36px] items-center justify-center rounded-[11px] ${
            isVoid ? 'bg-red-soft' : 'bg-surface'
          }`}
        >
          <FontAwesome6
            name={isVoid ? 'ban' : 'receipt'}
            size={14}
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
              {item.receipt_number}
            </Text>
            <View
              className={`rounded-[6px] px-1.5 py-0.5 ${
                isVoid ? 'bg-red-soft' : 'bg-surface'
              }`}
            >
              <Text
                className={`font-extrabold text-[9.5px] ${
                  isVoid ? 'text-red' : 'text-muted'
                }`}
              >
                {isVoid ? 'VOID' : 'SELESAI'}
              </Text>
            </View>
          </View>

          <Text className="mt-0.5 font-medium text-[12px] text-muted" numberOfLines={1}>
            {isVoid
              ? item.void_reason ?? 'Dibatalkan'
              : `${itemSummary} (${totalUnits} unit)`}
          </Text>

          <Text
            className="mt-0.5 font-medium text-[11px] text-muted"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatTimeOnly(item.created_at)} • {formatDateTime(item.created_at)}
          </Text>
        </View>

        <Text
          className={`font-extrabold text-[14px] ${
            isVoid ? 'text-muted line-through' : 'text-black'
          }`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatRupiah(item.total_amount)}
        </Text>
      </MotionPressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3.5 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[20px] tracking-[-0.03em] text-black">
              Riwayat
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full bg-red" />
              <Text className="font-medium text-[12px] text-muted">Sinkron otomatis</Text>
            </View>
          </View>

          <MotionPressable
            onPress={() => router.push('/profil')}
            accessibilityLabel="Pengaturan Printer Thermal"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="print" size={15} color="#09090B" solid />
          </MotionPressable>
        </View>

        {/* Segmented Filter Control */}
        <View className="mb-3.5 flex-row gap-1 rounded-[13px] bg-surface p-1">
          {[
            { key: 'all' as const, label: `Semua (${sales.length})` },
            {
              key: 'completed' as const,
              label: `Selesai (${sales.filter((s) => s.status === 'completed').length})`,
            },
            {
              key: 'void' as const,
              label: `Void (${sales.filter((s) => s.status === 'void').length})`,
            },
          ].map((opt) => {
            const active = filter === opt.key;
            return (
              <MotionPressable
                key={opt.key}
                wrapperClassName="flex-1"
                onPress={() => setFilter(opt.key)}
                scaleTo={0.97}
                className={`items-center rounded-[9px] py-2 ${active ? 'bg-white' : ''}`}
                style={
                  active
                    ? {
                        shadowColor: '#09090B',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 3,
                        elevation: 1,
                      }
                    : undefined
                }
              >
                <Text
                  className={`font-bold text-[11.5px] ${
                    active ? 'text-black' : 'text-muted'
                  }`}
                >
                  {opt.label}
                </Text>
              </MotionPressable>
            );
          })}
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#D91E2A" />
          </View>
        ) : (
          <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                colors={['#D91E2A']}
                tintColor="#D91E2A"
              />
            }
            ListEmptyComponent={
              <View className="mt-6 items-center rounded-card border border-border bg-white p-6">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
                  <FontAwesome6 name="receipt" size={18} color="#D91E2A" solid />
                </View>
                <Text className="font-extrabold text-[15px] text-black">
                  Belum Ada Transaksi
                </Text>
                <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
                  Setiap transaksi dari layar Kasir akan langsung muncul di sini secara realtime.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
