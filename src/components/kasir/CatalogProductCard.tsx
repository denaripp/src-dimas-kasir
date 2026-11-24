import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import { formatRupiah } from '@/lib/format';
import { useCartStore } from '@/store/useCartStore';
import type { ProductRow } from '@/types/database';

interface CatalogProductCardProps {
  product: ProductRow;
  onAdd: (product: ProductRow) => void;
  onStepQty: (productId: string, nextQty: number) => void;
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  minusPressed: {
    opacity: 0.7,
  },
});

/**
 * Kartu produk 2-kolom ringan untuk FlatList Kasir.
 * - Subscribe atomik ke qty produk sendiri di Zustand -> tap 1 barang hanya re-render 1 kartu.
 * - Memakai native Pressable (0 Reanimated shared values/worklets di dalam list).
 */
export const CatalogProductCard = memo(function CatalogProductCard({
  product,
  onAdd,
  onStepQty,
}: CatalogProductCardProps) {
  const qty = useCartStore(
    useCallback(
      (s) => s.items.find((i) => i.productId === product.id)?.qty ?? 0,
      [product.id],
    ),
  );

  const isLow = product.stock <= product.min_stock;
  const isOut = product.stock <= 0;

  return (
    <View className="w-1/2 p-1.5">
      <Pressable
        onPress={() => onAdd(product)}
        style={({ pressed }) => (pressed ? styles.cardPressed : undefined)}
        className={`rounded-2xl border bg-white p-2 ${
          qty > 0 ? 'border-[1.5px] border-red' : 'border-border'
        }`}
      >
        <View className="relative mb-2">
          <ProductThumbnail
            imageUrl={product.image_url}
            fillWidth
            aspectRatio={4 / 3}
            iconSize={22}
          />

          {qty > 0 ? (
            <View className="absolute right-1.5 top-1.5 min-w-[24px] items-center justify-center rounded-full bg-red px-1.5 py-0.5">
              <Text
                className="font-extrabold text-[11px] text-white"
                style={styles.tabular}
              >
                {qty}
              </Text>
            </View>
          ) : null}

          <View
            className={`absolute bottom-1.5 left-1.5 rounded-[6px] px-1.5 py-0.5 ${
              isLow || isOut ? 'bg-red-soft' : 'bg-white/95'
            }`}
          >
            <Text
              className={`text-[10px] font-bold ${
                isLow || isOut ? 'text-red' : 'text-black'
              }`}
              style={styles.tabular}
            >
              {isOut ? 'Habis' : `Stok ${product.stock}`}
            </Text>
          </View>
        </View>

        <Text
          className="min-h-[34px] font-bold text-[12.5px] leading-[17px] text-black"
          numberOfLines={2}
        >
          {product.name}
        </Text>

        <View className="mt-1.5 flex-row items-center justify-between gap-1">
          <Text
            className="font-extrabold text-[13px] text-black"
            style={styles.tabular}
            numberOfLines={1}
          >
            {formatRupiah(product.sell_price)}
          </Text>

          {qty > 0 ? (
            <Pressable
              onPress={() => onStepQty(product.id, qty - 1)}
              hitSlop={6}
              accessibilityLabel={`Kurangi ${product.name}`}
              style={({ pressed }) => (pressed ? styles.minusPressed : undefined)}
              className="h-6 w-6 items-center justify-center rounded-[7px] border border-border bg-white"
            >
              <FontAwesome6 name="minus" size={10} color="#09090B" solid />
            </Pressable>
          ) : (
            <Text className="font-bold text-[11px] text-muted">+ Tap</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
});
