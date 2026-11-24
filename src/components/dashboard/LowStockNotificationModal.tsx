import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import type { ProductRow } from '@/types/database';

interface LowStockNotificationModalProps {
  visible: boolean;
  products: ProductRow[];
  onRestock: (productId: string) => void;
  onClose: () => void;
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: 8,
    paddingVertical: 2,
  },
});

const NotificationItemRow = memo(function NotificationItemRow({
  item,
  onRestock,
}: {
  item: ProductRow;
  onRestock: (productId: string) => void;
}) {
  const isOutOfStock = item.stock <= 0;

  return (
    <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
      <ProductThumbnail imageUrl={item.image_url} size={40} iconSize={14} />

      <View className="flex-1">
        <Text className="font-bold text-[13px] text-black" numberOfLines={1}>
          {item.name}
        </Text>
        <Text
          className={`mt-0.5 text-[11.5px] ${
            isOutOfStock ? 'font-extrabold text-red' : 'font-semibold text-muted'
          }`}
          style={styles.tabular}
          numberOfLines={1}
        >
          {isOutOfStock
            ? `Stok habis (0) · Min. ${item.min_stock}`
            : `Sisa ${item.stock} · Min. ${item.min_stock}`}
        </Text>
      </View>

      <MotionPressable
        onPress={() => onRestock(item.id)}
        accessibilityLabel={`Tambah stok ${item.name}`}
        className="flex-row items-center gap-1 rounded-[9px] bg-red-soft px-2.5 py-2"
      >
        <FontAwesome6 name="plus" size={10} color="#D91E2A" solid />
        <Text className="font-extrabold text-[11.5px] text-red">Stok</Text>
      </MotionPressable>
    </View>
  );
});

const keyExtractor = (item: ProductRow) => item.id;

export const LowStockNotificationModal = memo(function LowStockNotificationModal({
  visible,
  products,
  onRestock,
  onClose,
}: LowStockNotificationModalProps) {
  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) => {
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.name.localeCompare(b.name);
      }),
    [products],
  );

  const outOfStockCount = useMemo(
    () => products.filter((p) => p.stock <= 0).length,
    [products],
  );
  const lowOnlyCount = products.length - outOfStockCount;

  const subtitle = useMemo(() => {
    if (products.length === 0) return 'Semua stok dalam kondisi aman';
    if (outOfStockCount > 0 && lowOnlyCount > 0) {
      return `${outOfStockCount} habis · ${lowOnlyCount} menipis`;
    }
    if (outOfStockCount > 0) return `${outOfStockCount} barang stok habis`;
    return `${lowOnlyCount} barang stok menipis`;
  }, [products.length, outOfStockCount, lowOnlyCount]);

  const renderItem = useCallback(
    ({ item }: { item: ProductRow }) => (
      <NotificationItemRow item={item} onRestock={onRestock} />
    ),
    [onRestock],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <View className="w-full max-w-[380px] rounded-hero border border-border bg-white p-5">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3">
            <View className="flex-row items-center gap-2.5">
              <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${
                  products.length > 0 ? 'bg-red-soft' : 'bg-emerald-50'
                }`}
              >
                <FontAwesome6
                  name={products.length > 0 ? 'bell' : 'circle-check'}
                  size={14}
                  color={products.length > 0 ? '#D91E2A' : '#059669'}
                  solid
                />
              </View>
              <View>
                <Text className="font-extrabold text-[15.5px] tracking-[-0.02em] text-black">
                  Notifikasi Stok
                </Text>
                <Text className="mt-0.5 font-medium text-[11.5px] text-muted">
                  {subtitle}
                </Text>
              </View>
            </View>

            <MotionPressable
              onPress={onClose}
              accessibilityLabel="Tutup notifikasi"
              className="h-8 w-8 items-center justify-center rounded-full bg-surface"
            >
              <FontAwesome6 name="xmark" size={12} color="#71717A" solid />
            </MotionPressable>
          </View>

          {/* Body */}
          {sortedProducts.length === 0 ? (
            <View className="my-3 items-center rounded-card border border-border bg-surface px-4 py-6">
              <View className="mb-2.5 h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                <FontAwesome6 name="check" size={16} color="#059669" solid />
              </View>
              <Text className="font-extrabold text-[14px] text-black">
                Semua Stok Aman
              </Text>
              <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
                Tidak ada barang yang habis atau mencapai batas stok minimum saat ini.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sortedProducts}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}

          {/* Footer */}
          <View className="mt-3.5">
            <MotionPressable
              onPress={onClose}
              className="min-h-[42px] items-center justify-center rounded-control border border-border bg-white py-2.5"
            >
              <Text className="font-bold text-[13px] text-black">Tutup</Text>
            </MotionPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});
