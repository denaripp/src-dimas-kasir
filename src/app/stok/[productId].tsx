import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  useAdjustStockMutation,
  useProductByIdQuery,
  useStockMovementsQuery,
} from '@/hooks/useProducts';
import { formatDateTime } from '@/lib/format';
import type { ProductRow, StockMovementRow, StockMovementType } from '@/types/database';

type ManualMode = 'stok_masuk' | 'penyesuaian';

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  stok_masuk: 'Stok Masuk',
  penyesuaian: 'Penyesuaian',
  penjualan: 'Penjualan',
  void: 'Void Transaksi',
};

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  heroShadow: {
    shadowColor: '#D91E2A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 4,
  },
});

const StockMovementRowItem = memo(function StockMovementRowItem({
  item,
  isFirst,
  isLast,
}: {
  item: StockMovementRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isPositive = item.qty_delta > 0;
  const isVoid = item.type === 'void';

  return (
    <View
      className={`flex-row items-center justify-between gap-2.5 border-x border-border bg-white px-3.5 py-3 ${
        isFirst ? 'rounded-t-card border-t' : ''
      } ${isLast ? 'rounded-b-card border-b' : 'border-b border-border'}`}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-bold text-[13.5px] text-black">
            {MOVEMENT_LABELS[item.type]}
          </Text>
          {isVoid ? (
            <View className="rounded-[6px] bg-red-soft px-1.5 py-0.5">
              <Text className="font-extrabold text-[9.5px] text-red">VOID</Text>
            </View>
          ) : null}
        </View>
        {item.note ? (
          <Text className="mt-0.5 font-medium text-[12px] text-muted" numberOfLines={2}>
            {item.note}
          </Text>
        ) : null}
        <Text className="mt-0.5 font-medium text-[11px] text-muted" style={styles.tabular}>
          {formatDateTime(item.created_at)} • Stok sesudah: {item.stock_after}
        </Text>
      </View>

      <Text
        className={`font-extrabold text-[15px] ${
          isPositive ? 'text-black' : 'text-red'
        }`}
        style={styles.tabular}
      >
        {isPositive ? `+${item.qty_delta}` : `${item.qty_delta}`}
      </Text>
    </View>
  );
});

const StockAdjustFormHeader = memo(function StockAdjustFormHeader({
  productId,
  product,
  movementCount,
}: {
  productId: string | undefined;
  product: ProductRow | null | undefined;
  movementCount: number;
}) {
  const adjustMutation = useAdjustStockMutation();

  const [mode, setMode] = useState<ManualMode>('stok_masuk');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [qtyText, setQtyText] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const parsedQty = Number.parseInt(qtyText.trim(), 10);
  const validQty = Number.isInteger(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const effectiveDelta = mode === 'stok_masuk' ? validQty : direction * validQty;
  const currentStock = product?.stock ?? 0;
  const projectedStock = currentStock + effectiveDelta;

  const handleSubmit = async () => {
    if (!productId || !product) return;

    setFormError(null);
    if (validQty <= 0) {
      setFormError('Jumlah mutasi harus lebih dari 0.');
      return;
    }

    if (projectedStock < 0) {
      setFormError('Hasil stok akhir tidak boleh kurang dari 0.');
      return;
    }

    if (mode === 'penyesuaian' && note.trim().length === 0) {
      setFormError('Alasan penyesuaian stok wajib diisi.');
      return;
    }

    try {
      await adjustMutation.mutateAsync({
        productId,
        type: mode,
        qtyDelta: effectiveDelta,
        note,
      });
      setQtyText('');
      setNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui stok.');
    }
  };

  return (
    <View className="mb-4">
      {/* Product Summary Hero Card */}
      <View className="mb-4 rounded-hero bg-red p-5" style={styles.heroShadow}>
        <Text className="font-semibold text-[11.5px] text-white/85">
          {product?.barcode ?? 'Tanpa barcode'}
          {product?.category ? ` • ${product.category}` : ''}
        </Text>
        <Text className="mt-0.5 font-extrabold text-[18.5px] text-white">
          {product?.name ?? 'Barang'}
        </Text>
        <View className="my-3 h-[1px] bg-white/20" />
        <View className="flex-row items-baseline justify-between">
          <View>
            <Text className="font-medium text-[11px] text-white/85">Stok Saat Ini</Text>
            <Text className="mt-0.5 font-extrabold text-[25px] text-white" style={styles.tabular}>
              {currentStock} unit
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-medium text-[11px] text-white/85">Batas Minimum</Text>
            <Text className="mt-0.5 font-extrabold text-[16px] text-white" style={styles.tabular}>
              {product?.min_stock ?? 0} unit
            </Text>
          </View>
        </View>
      </View>

      {/* Segmented Mode Switcher */}
      <View className="mb-3.5 flex-row gap-1 rounded-[13px] bg-surface p-1">
        <MotionPressable
          wrapperClassName="flex-1"
          onPress={() => {
            setMode('stok_masuk');
            setDirection(1);
            setFormError(null);
          }}
          scaleTo={0.97}
          className={`items-center rounded-[9px] py-2.5 ${
            mode === 'stok_masuk' ? 'bg-white' : ''
          }`}
        >
          <Text
            className={`font-bold text-[12px] ${
              mode === 'stok_masuk' ? 'text-black' : 'text-muted'
            }`}
          >
            Stok Masuk
          </Text>
        </MotionPressable>

        <MotionPressable
          wrapperClassName="flex-1"
          onPress={() => {
            setMode('penyesuaian');
            setFormError(null);
          }}
          scaleTo={0.97}
          className={`items-center rounded-[9px] py-2.5 ${
            mode === 'penyesuaian' ? 'bg-white' : ''
          }`}
        >
          <Text
            className={`font-bold text-[12px] ${
              mode === 'penyesuaian' ? 'text-black' : 'text-muted'
            }`}
          >
            Penyesuaian
          </Text>
        </MotionPressable>
      </View>

      {/* Form Card */}
      <View className="mb-5 rounded-card border border-border bg-white p-4">
        {mode === 'penyesuaian' ? (
          <View className="mb-3 flex-row gap-2">
            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => setDirection(1)}
              className={`flex-row items-center justify-center gap-1.5 rounded-chip border py-2 ${
                direction === 1 ? 'border-black bg-black' : 'border-border bg-white'
              }`}
            >
              <FontAwesome6
                name="plus"
                size={11}
                color={direction === 1 ? '#FFFFFF' : '#09090B'}
                solid
              />
              <Text
                className={`font-bold text-[12px] ${
                  direction === 1 ? 'text-white' : 'text-black'
                }`}
              >
                Tambah
              </Text>
            </MotionPressable>

            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => setDirection(-1)}
              className={`flex-row items-center justify-center gap-1.5 rounded-chip border py-2 ${
                direction === -1 ? 'border-red bg-red' : 'border-border bg-white'
              }`}
            >
              <FontAwesome6
                name="minus"
                size={11}
                color={direction === -1 ? '#FFFFFF' : '#09090B'}
                solid
              />
              <Text
                className={`font-bold text-[12px] ${
                  direction === -1 ? 'text-white' : 'text-black'
                }`}
              >
                Kurangi
              </Text>
            </MotionPressable>
          </View>
        ) : null}

        <Text className="mb-1.5 font-bold text-[12px] text-black">
          Jumlah {mode === 'stok_masuk' ? 'Masuk' : 'Selisih'} *
        </Text>
        <TextInput
          value={qtyText}
          onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#71717A"
          className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-extrabold text-[15px] text-black"
        />

        <Text className="mb-1.5 font-bold text-[12px] text-black">
          {mode === 'penyesuaian' ? 'Alasan Penyesuaian *' : 'Catatan (Opsional)'}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={
            mode === 'penyesuaian'
              ? 'Contoh: Barang rusak / hitung ulang fisik'
              : 'Contoh: Belanja dari agen'
          }
          placeholderTextColor="#71717A"
          className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-medium text-[13px] text-black"
        />

        <View className="mb-3.5 flex-row items-center justify-between border-t border-dashed border-border pt-2.5">
          <Text className="font-semibold text-[12px] text-muted">Perkiraan Stok Akhir</Text>
          <Text
            className={`font-extrabold text-[15px] ${
              projectedStock < 0 ? 'text-red' : 'text-black'
            }`}
            style={styles.tabular}
          >
            {projectedStock} unit
          </Text>
        </View>

        {formError ? (
          <Text className="mb-3 font-bold text-[12px] text-red">{formError}</Text>
        ) : null}

        <MotionPressable
          onPress={() => void handleSubmit()}
          disabled={adjustMutation.isPending}
          className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
        >
          {adjustMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
          )}
          <Text className="font-extrabold text-[13.5px] text-white">
            {adjustMutation.isPending ? 'Memproses...' : 'Simpan Mutasi Stok'}
          </Text>
        </MotionPressable>
      </View>

      <Text className="font-extrabold text-[14px] text-black">
        Riwayat Mutasi Stok ({movementCount})
      </Text>
    </View>
  );
});

const keyExtractor = (item: StockMovementRow) => item.id;

export default function StockManageScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const { data: product, isLoading } = useProductByIdQuery(productId);
  const { data: movements = [], isLoading: loadingMovements } =
    useStockMovementsQuery(productId);

  const totalCount = movements.length;
  const renderMovement = useCallback(
    ({ item, index }: { item: StockMovementRow; index: number }) => (
      <StockMovementRowItem
        item={item}
        isFirst={index === 0}
        isLast={index === totalCount - 1}
      />
    ),
    [totalCount],
  );

  const listHeader = useMemo(
    () => (
      <StockAdjustFormHeader
        productId={productId}
        product={product}
        movementCount={movements.length}
      />
    ),
    [productId, product, movements.length],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#D91E2A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-[18px] py-3">
        <MotionPressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="chevron-left" size={14} color="#09090B" solid />
        </MotionPressable>
        <Text className="font-extrabold text-[16px] tracking-[-0.02em] text-black">
          Kelola Stok
        </Text>
        <View className="h-10 w-10" />
      </View>

      <FlatList
        data={movements}
        keyExtractor={keyExtractor}
        renderItem={renderMovement}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loadingMovements ? (
            <ActivityIndicator size="small" color="#D91E2A" />
          ) : (
            <View className="rounded-card border border-border bg-white p-4">
              <Text className="font-medium text-[12.5px] text-muted">
                Belum ada riwayat mutasi untuk barang ini.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
