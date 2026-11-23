import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useSalesHistoryQuery, useSalesRealtime } from '@/hooks/useSales';
import { formatDateTime, formatRupiah, formatTimeOnly } from '@/lib/format';
import type { SaleWithItems } from '@/lib/reportCalc';

type HistoryFilter = 'all' | 'completed' | 'void';

export default function RiwayatScreen() {
  const router = useRouter();
  const { store } = useAuth();
  useSalesRealtime(store?.id);

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

  const renderItem = ({ item }: { item: SaleWithItems }) => {
    const isVoid = item.status === 'void';
    const totalUnits = (item.sale_items ?? []).reduce((sum, si) => sum + si.qty, 0);
    const firstItemName = item.sale_items?.[0]?.product_name_snapshot;
    const itemSummary =
      (item.sale_items?.length ?? 0) > 1
        ? `${firstItemName} +${item.sale_items.length - 1} lainnya`
        : firstItemName ?? `${totalUnits} item`;

    return (
      <Pressable
        onPress={() => router.push(`/riwayat/${item.id}`)}
        className={`mb-2.5 flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] px-3.5 py-3 ${
          isVoid ? 'border-red bg-red' : 'border-black bg-white'
        }`}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className={`font-extrabold text-[14px] ${
                isVoid ? 'text-white' : 'text-black'
              }`}
              numberOfLines={1}
            >
              {item.receipt_number}
            </Text>
          </View>

          <Text
            className={`mt-0.5 font-semibold text-[12px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
            numberOfLines={1}
          >
            {isVoid
              ? `VOID • ${item.void_reason ?? 'Dibatalkan'}`
              : `${itemSummary} (${totalUnits} unit)`}
          </Text>

          <Text
            className={`mt-0.5 font-medium text-[11px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
          >
            {formatTimeOnly(item.created_at)} • {formatDateTime(item.created_at)}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text
            className={`font-extrabold text-[14px] ${
              isVoid ? 'text-white line-through' : 'text-black'
            }`}
          >
            {formatRupiah(item.total_amount)}
          </Text>
          <Text
            className={`font-extrabold text-[10px] uppercase ${
              isVoid ? 'text-white' : 'text-red'
            }`}
          >
            {isVoid ? 'VOID' : 'SELESAI'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[18px] text-black">Riwayat Realtime</Text>
            <Text className="font-semibold text-[11px] text-red">
              <FontAwesome6 name="wifi" size={10} color="#D91E2A" solid /> Sinkron otomatis
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/profil')}
            accessibilityLabel="Pengaturan Printer Thermal"
            className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
          >
            <FontAwesome6 name="print" size={15} color="#09090B" solid />
          </Pressable>
        </View>

        {/* Status Filter Strip */}
        <View className="mb-3 flex-row gap-2">
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
              <Pressable
                key={opt.key}
                onPress={() => setFilter(opt.key)}
                className={`flex-1 items-center rounded-chip border-[1.5px] py-2 ${
                  active ? 'border-red bg-red' : 'border-black bg-white'
                }`}
              >
                <Text
                  className={`font-extrabold text-[11.5px] ${
                    active ? 'text-white' : 'text-black'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
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
              <View className="mt-6 items-center rounded-card border-[1.5px] border-black bg-white p-6">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red">
                  <FontAwesome6 name="receipt" size={18} color="#FFFFFF" solid />
                </View>
                <Text className="font-extrabold text-[15px] text-black">
                  Belum Ada Transaksi
                </Text>
                <Text className="mt-1 text-center font-medium text-[12px] text-black">
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
