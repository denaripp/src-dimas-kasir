import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import { CameraBarcodeModal } from '@/components/scanner/CameraBarcodeModal';
import { useAuth } from '@/hooks/useAuth';
import { useProductsQuery } from '@/hooks/useProducts';
import { formatRupiah } from '@/lib/format';
import {
  countLowStockProducts,
  extractProductCategories,
  filterProducts,
} from '@/lib/productFilters';
import type { ProductRow } from '@/types/database';

type FilterMode = 'all' | 'low_stock' | `cat:${string}`;

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  chipStrip: {
    gap: 6,
  },
  listContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  rowPressed: {
    opacity: 0.85,
  },
});

const ProductListRow = memo(function ProductListRow({
  item,
  isFirst,
  isLast,
  onOpenDetail,
  onOpenStock,
}: {
  item: ProductRow;
  isFirst: boolean;
  isLast: boolean;
  onOpenDetail: (id: string) => void;
  onOpenStock: (id: string) => void;
}) {
  const isLowStock = item.stock <= item.min_stock;

  return (
    <Pressable
      onPress={() => onOpenDetail(item.id)}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
      className={`flex-row items-center gap-3 border-x border-border bg-white px-3.5 py-3 ${
        isFirst ? 'rounded-t-card border-t' : ''
      } ${isLast ? 'rounded-b-card border-b' : 'border-b border-border'}`}
    >
      <ProductThumbnail imageUrl={item.image_url} size={52} iconSize={18} />

      <View className="flex-1">
        <Text className="font-bold text-[13.5px] text-black" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mt-0.5 font-medium text-[11.5px] text-muted" numberOfLines={1}>
          {item.category ? `${item.category} • ` : ''}
          {item.barcode ? item.barcode : 'Tanpa barcode'}
        </Text>
        <View className="mt-1.5 flex-row">
          <View
            className={`rounded-[7px] px-2 py-0.5 ${
              isLowStock ? 'bg-red-soft' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                isLowStock ? 'text-red' : 'text-muted'
              }`}
              style={styles.tabular}
            >
              {isLowStock ? `Stok ${item.stock} · Menipis` : `Stok ${item.stock}`}
            </Text>
          </View>
        </View>
      </View>

      <View className="items-end gap-1.5">
        <Text
          className="font-extrabold text-[13.5px] text-black"
          style={styles.tabular}
        >
          {formatRupiah(item.sell_price)}
        </Text>
        <Pressable
          onPress={() => onOpenStock(item.id)}
          hitSlop={6}
          accessibilityLabel={`Kelola stok ${item.name}`}
          style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
          className="h-7 w-7 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="plus" size={11} color="#09090B" solid />
        </Pressable>
      </View>
    </Pressable>
  );
});

const keyExtractor = (item: ProductRow) => item.id;

export default function BarangScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { store } = useAuth();
  const {
    data: products = [],
    isLoading,
    isRefetching,
    refetch,
  } = useProductsQuery(store?.id);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (isFocused) {
      void refetch();
    }
  }, [isFocused, refetch]);

  const lowStockCount = useMemo(() => countLowStockProducts(products), [products]);
  const categories = useMemo(() => extractProductCategories(products), [products]);

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, {
        search: deferredSearch,
        lowStockOnly: filterMode === 'low_stock',
        category: filterMode.startsWith('cat:') ? filterMode.slice(4) : undefined,
      }),
    [products, deferredSearch, filterMode],
  );

  const handleOpenDetail = useCallback(
    (id: string) => router.push(`/barang/${id}`),
    [router],
  );
  const handleOpenStock = useCallback(
    (id: string) => router.push(`/stok/${id}`),
    [router],
  );

  const totalFiltered = filteredProducts.length;
  const renderItem = useCallback(
    ({ item, index }: { item: ProductRow; index: number }) => (
      <ProductListRow
        item={item}
        isFirst={index === 0}
        isLast={index === totalFiltered - 1}
        onOpenDetail={handleOpenDetail}
        onOpenStock={handleOpenStock}
      />
    ),
    [totalFiltered, handleOpenDetail, handleOpenStock],
  );

  const emptyComponent = useMemo(
    () => (
      <View className="mt-6 items-center rounded-card border border-border bg-white p-6">
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
          <FontAwesome6 name="cube" size={18} color="#D91E2A" solid />
        </View>
        <Text className="text-center font-extrabold text-[15px] text-black">
          {products.length === 0 ? 'Belum Ada Barang' : 'Barang Tidak Ditemukan'}
        </Text>
        <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
          {products.length === 0
            ? 'Tambah barang satu per satu atau impor sekaligus lewat file CSV.'
            : 'Coba ubah kata kunci pencarian atau filter kategori.'}
        </Text>
        {products.length === 0 ? (
          <MotionPressable
            onPress={() => router.push('/barang/new')}
            className="mt-4 rounded-control bg-red px-5 py-3"
          >
            <Text className="font-extrabold text-[13px] text-white">
              Tambah Barang Pertama
            </Text>
          </MotionPressable>
        ) : null}
      </View>
    ),
    [products.length, router],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3.5 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[20px] tracking-[-0.03em] text-black">
              Barang &amp; Stok
            </Text>
            <Text className="mt-0.5 font-medium text-[12px] text-muted">
              {products.length} barang aktif • {lowStockCount} stok menipis
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <MotionPressable
              onPress={() => router.push('/barang/csv')}
              accessibilityLabel="Import dan Export CSV Barang"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <FontAwesome6 name="file-arrow-up" size={15} color="#09090B" solid />
            </MotionPressable>
            <MotionPressable
              onPress={() => router.push('/barang/new')}
              accessibilityLabel="Tambah Barang Baru"
              className="h-10 w-10 items-center justify-center rounded-full bg-red"
            >
              <FontAwesome6 name="plus" size={15} color="#FFFFFF" solid />
            </MotionPressable>
          </View>
        </View>

        {/* Soft Search Input + Camera Scanner */}
        <View className="mb-3 flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2.5 rounded-control bg-surface px-3.5 py-2.5">
            <FontAwesome6 name="magnifying-glass" size={13} color="#71717A" solid />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Cari nama barang atau barcode..."
              placeholderTextColor="#71717A"
              className="flex-1 font-semibold text-[13px] text-black"
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <Pressable
                onPress={() => setSearch('')}
                accessibilityLabel="Hapus pencarian"
                hitSlop={8}
              >
                <FontAwesome6 name="xmark" size={14} color="#71717A" solid />
              </Pressable>
            ) : null}
          </View>

          <MotionPressable
            onPress={() => setCameraOpen(true)}
            accessibilityLabel="Pindai barcode barang dengan kamera"
            className="h-[44px] w-[44px] items-center justify-center rounded-control bg-surface"
          >
            <FontAwesome6 name="camera" size={15} color="#09090B" solid />
          </MotionPressable>
        </View>

        {/* Filter Chips */}
        <View className="mb-3.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
          >
            <Pressable
              onPress={() => setFilterMode('all')}
              className={`rounded-chip border px-3 py-1.5 ${
                filterMode === 'all' ? 'border-black bg-black' : 'border-border bg-white'
              }`}
            >
              <Text
                className={`text-[12px] ${
                  filterMode === 'all' ? 'font-bold text-white' : 'font-semibold text-black'
                }`}
              >
                Semua ({products.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterMode('low_stock')}
              className={`rounded-chip border px-3 py-1.5 ${
                filterMode === 'low_stock' ? 'border-red bg-red' : 'border-border bg-white'
              }`}
            >
              <Text
                className={`text-[12px] ${
                  filterMode === 'low_stock'
                    ? 'font-bold text-white'
                    : 'font-semibold text-black'
                }`}
              >
                Menipis ({lowStockCount})
              </Text>
            </Pressable>

            {categories.map((cat) => {
              const key: FilterMode = `cat:${cat}`;
              const active = filterMode === key;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setFilterMode(key)}
                  className={`rounded-chip border px-3 py-1.5 ${
                    active ? 'border-black bg-black' : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
                      active ? 'font-bold text-white' : 'font-semibold text-black'
                    }`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Product List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#D91E2A" />
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

      <CameraBarcodeModal
        visible={cameraOpen}
        title="Pindai Barcode / QR"
        closeOnScan
        onScan={(code) => setSearch(code)}
        onClose={() => setCameraOpen(false)}
      />
    </SafeAreaView>
  );
}
