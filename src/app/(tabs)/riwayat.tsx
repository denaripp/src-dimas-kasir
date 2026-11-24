import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { PrinterSettingsModal } from '@/components/printer/PrinterSettingsModal';
import { useAuth } from '@/hooks/useAuth';
import { useSalesHistoryQuery } from '@/hooks/useSales';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { SaleWithItems } from '@/lib/reportCalc';

type HistoryFilter = 'all' | 'completed' | 'void';

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  rowPressed: {
    opacity: 0.85,
  },
  activeSegmentShadow: {
    shadowColor: '#09090B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
});

const SaleHistoryRow = memo(function SaleHistoryRow({
  item,
  isFirst,
  isLast,
  onOpenDetail,
}: {
  item: SaleWithItems;
  isFirst: boolean;
  isLast: boolean;
  onOpenDetail: (id: string) => void;
}) {
  const isVoid = item.status === 'void';
  const saleItems = item.sale_items ?? [];
  let totalUnits = 0;
  for (const si of saleItems) {
    totalUnits += si.qty;
  }
  const firstItemName = saleItems[0]?.product_name_snapshot;
  const itemSummary =
    saleItems.length > 1
      ? `${firstItemName} +${saleItems.length - 1} lainnya`
      : firstItemName ?? `${totalUnits} item`;

  return (
    <Pressable
      onPress={() => onOpenDetail(item.id)}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
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
            style={styles.tabular}
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

        <Text className="mt-0.5 font-medium text-[11px] text-muted" style={styles.tabular}>
          {formatDateTime(item.created_at)}
        </Text>
      </View>

      <Text
        className={`font-extrabold text-[14px] ${
          isVoid ? 'text-muted line-through' : 'text-black'
        }`}
        style={styles.tabular}
      >
        {formatRupiah(item.total_amount)}
      </Text>
    </Pressable>
  );
});

const keyExtractor = (item: SaleWithItems) => item.id;

const emptyComponent = (
  <View className="mt-6 items-center rounded-card border border-border bg-white p-6">
    <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
      <FontAwesome6 name="receipt" size={18} color="#D91E2A" solid />
    </View>
    <Text className="font-extrabold text-[15px] text-black">Belum Ada Transaksi</Text>
    <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
      Setiap transaksi dari layar Kasir akan langsung muncul di sini secara realtime.
    </Text>
  </View>
);

export default function RiwayatScreen() {
  const router = useRouter();
  const { store } = useAuth();

  const {
    data: sales = [],
    isLoading,
    isRefetching,
    refetch,
  } = useSalesHistoryQuery(store?.id);

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  const statusCounts = useMemo(() => {
    let completed = 0;
    let voided = 0;
    for (const s of sales) {
      if (s.status === 'void') voided += 1;
      else completed += 1;
    }
    return { completed, voided };
  }, [sales]);

  const filteredSales = useMemo(() => {
    if (filter === 'all') return sales;
    return sales.filter((s) => s.status === filter);
  }, [sales, filter]);

  const handleOpenDetail = useCallback(
    (id: string) => router.push(`/riwayat/${id}`),
    [router],
  );

  const totalFiltered = filteredSales.length;
  const renderItem = useCallback(
    ({ item, index }: { item: SaleWithItems; index: number }) => (
      <SaleHistoryRow
        item={item}
        isFirst={index === 0}
        isLast={index === totalFiltered - 1}
        onOpenDetail={handleOpenDetail}
      />
    ),
    [totalFiltered, handleOpenDetail],
  );

  const filterTabs = useMemo(
    () => [
      { key: 'all' as const, label: `Semua (${sales.length})` },
      { key: 'completed' as const, label: `Selesai (${statusCounts.completed})` },
      { key: 'void' as const, label: `Void (${statusCounts.voided})` },
    ],
    [sales.length, statusCounts.completed, statusCounts.voided],
  );

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
            onPress={() => setPrinterModalOpen(true)}
            accessibilityLabel="Pengaturan Printer Thermal"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="print" size={15} color="#09090B" solid />
          </MotionPressable>
        </View>

        {/* Segmented Filter Control */}
        <View className="mb-3.5 flex-row gap-1 rounded-[13px] bg-surface p-1">
          {filterTabs.map((opt) => {
            const active = filter === opt.key;
            return (
              <MotionPressable
                key={opt.key}
                wrapperClassName="flex-1"
                onPress={() => setFilter(opt.key)}
                scaleTo={0.97}
                className={`items-center rounded-[9px] py-2 ${active ? 'bg-white' : ''}`}
                style={active ? styles.activeSegmentShadow : undefined}
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
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                colors={['#D91E2A']}
                tintColor="#D91E2A"
              />
            }
            ListEmptyComponent={emptyComponent}
          />
        )}
      </View>

      <PrinterSettingsModal
        visible={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
      />
    </SafeAreaView>
  );
}
