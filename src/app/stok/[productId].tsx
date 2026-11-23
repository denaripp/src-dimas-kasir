import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAdjustStockMutation,
  useProductByIdQuery,
  useStockMovementsQuery,
} from '@/hooks/useProducts';
import { formatDateTime } from '@/lib/format';
import type { StockMovementRow, StockMovementType } from '@/types/database';

type ManualMode = 'stok_masuk' | 'penyesuaian';

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  stok_masuk: 'Stok Masuk',
  penyesuaian: 'Penyesuaian',
  penjualan: 'Penjualan',
  void: 'Void Transaksi',
};

export default function StockManageScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const { data: product, isLoading } = useProductByIdQuery(productId);
  const { data: movements = [], isLoading: loadingMovements } =
    useStockMovementsQuery(productId);
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

  const renderMovement = ({ item }: { item: StockMovementRow }) => {
    const isPositive = item.qty_delta > 0;
    const isVoid = item.type === 'void';

    return (
      <View
        className={`mb-2.5 flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] px-3.5 py-3 ${
          isVoid ? 'border-red bg-red' : 'border-black bg-white'
        }`}
      >
        <View className="flex-1">
          <Text
            className={`font-extrabold text-[13.5px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
          >
            {MOVEMENT_LABELS[item.type]}
          </Text>
          {item.note ? (
            <Text
              className={`mt-0.5 font-medium text-[12px] ${
                isVoid ? 'text-white' : 'text-black'
              }`}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          ) : null}
          <Text
            className={`mt-1 font-medium text-[11px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
          >
            {formatDateTime(item.created_at)} • Stok sesudah: {item.stock_after}
          </Text>
        </View>

        <Text
          className={`font-extrabold text-[15px] ${
            isVoid ? 'text-white' : isPositive ? 'text-black' : 'text-red'
          }`}
        >
          {isPositive ? `+${item.qty_delta}` : `${item.qty_delta}`}
        </Text>
      </View>
    );
  };

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
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="chevron-left" size={15} color="#09090B" solid />
        </Pressable>
        <Text className="font-extrabold text-[16px] text-black">Kelola Stok</Text>
        <View className="h-10 w-10" />
      </View>

      <FlatList
        data={movements}
        keyExtractor={(item) => item.id}
        renderItem={renderMovement}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-4">
            {/* Product Summary Card */}
            <View className="mb-3.5 rounded-hero bg-red p-5">
              <Text className="font-semibold text-[11.5px] text-white">
                {product?.barcode ?? 'Tanpa barcode'}
              </Text>
              <Text className="mt-0.5 font-extrabold text-[19px] text-white">
                {product?.name ?? 'Barang'}
              </Text>
              <View className="mt-3 flex-row items-baseline justify-between">
                <View>
                  <Text className="font-medium text-[11px] text-white">Stok Saat Ini</Text>
                  <Text className="font-extrabold text-[26px] text-white">
                    {currentStock}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-medium text-[11px] text-white">Stok Minimum</Text>
                  <Text className="font-extrabold text-[17px] text-white">
                    {product?.min_stock ?? 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Mode Switcher */}
            <View className="mb-3 flex-row gap-2">
              <Pressable
                onPress={() => {
                  setMode('stok_masuk');
                  setDirection(1);
                  setFormError(null);
                }}
                className={`flex-1 items-center rounded-chip border-[1.5px] py-2.5 ${
                  mode === 'stok_masuk'
                    ? 'border-red bg-red'
                    : 'border-black bg-white'
                }`}
              >
                <Text
                  className={`font-extrabold text-[12.5px] ${
                    mode === 'stok_masuk' ? 'text-white' : 'text-black'
                  }`}
                >
                  Stok Masuk
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode('penyesuaian');
                  setFormError(null);
                }}
                className={`flex-1 items-center rounded-chip border-[1.5px] py-2.5 ${
                  mode === 'penyesuaian'
                    ? 'border-red bg-red'
                    : 'border-black bg-white'
                }`}
              >
                <Text
                  className={`font-extrabold text-[12.5px] ${
                    mode === 'penyesuaian' ? 'text-white' : 'text-black'
                  }`}
                >
                  Penyesuaian
                </Text>
              </Pressable>
            </View>

            {/* Form Card */}
            <View className="mb-5 rounded-card border-[1.5px] border-black bg-white p-4">
              {mode === 'penyesuaian' ? (
                <View className="mb-3 flex-row gap-2">
                  <Pressable
                    onPress={() => setDirection(1)}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-chip border-[1.5px] py-2 ${
                      direction === 1
                        ? 'border-black bg-black'
                        : 'border-black bg-white'
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
                  </Pressable>
                  <Pressable
                    onPress={() => setDirection(-1)}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-chip border-[1.5px] py-2 ${
                      direction === -1
                        ? 'border-red bg-red'
                        : 'border-black bg-white'
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
                  </Pressable>
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
                placeholderTextColor="#09090B"
                className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-extrabold text-[15px] text-black"
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
                placeholderTextColor="#09090B"
                className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-medium text-[13px] text-black"
              />

              <View className="mb-3 flex-row items-center justify-between border-t-[1.5px] border-dashed border-black pt-2.5">
                <Text className="font-semibold text-[12px] text-black">Perkiraan Stok Akhir</Text>
                <Text
                  className={`font-extrabold text-[15px] ${
                    projectedStock < 0 ? 'text-red' : 'text-black'
                  }`}
                >
                  {projectedStock}
                </Text>
              </View>

              {formError ? (
                <Text className="mb-3 font-bold text-[12px] text-red">{formError}</Text>
              ) : null}

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={adjustMutation.isPending}
                className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
              >
                {adjustMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                )}
                <Text className="font-extrabold text-[13.5px] text-white">
                  {adjustMutation.isPending ? 'Memproses...' : 'Simpan Mutasi Stok'}
                </Text>
              </Pressable>
            </View>

            <Text className="font-extrabold text-[14px] text-black">
              Riwayat Mutasi Stok ({movements.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          loadingMovements ? (
            <ActivityIndicator size="small" color="#D91E2A" />
          ) : (
            <View className="rounded-card border-[1.5px] border-black bg-white p-4">
              <Text className="font-medium text-[12.5px] text-black">
                Belum ada riwayat mutasi untuk barang ini.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
