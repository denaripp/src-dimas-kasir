import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import { useAuth } from '@/hooks/useAuth';
import { useProductsQuery } from '@/hooks/useProducts';
import { formatRupiah } from '@/lib/format';
import type { ProductRow } from '@/types/database';

type FilterMode = 'all' | 'low_stock' | `cat:${string}`;

export default function BarangScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const {
    data: products = [],
    isLoading,
    isRefetching,
    refetch,
  } = useProductsQuery(store?.id);

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= p.min_stock).length,
    [products],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const cat = p.category.trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filterMode === 'low_stock' && p.stock > p.min_stock) {
        return false;
      }
      if (filterMode.startsWith('cat:')) {
        const targetCat = filterMode.slice(4);
        if (p.category.trim() !== targetCat) {
          return false;
        }
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, filterMode]);

  const renderItem = ({ item, index }: { item: ProductRow; index: number }) => {
    const isLowStock = item.stock <= item.min_stock;
    const isFirst = index === 0;
    const isLast = index === filteredProducts.length - 1;

    return (
      <MotionPressable
        onPress={() => router.push(`/barang/${item.id}`)}
        scaleTo={0.985}
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
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {isLowStock ? `Stok ${item.stock} · Menipis` : `Stok ${item.stock}`}
              </Text>
            </View>
          </View>
        </View>

        <View className="items-end gap-1.5">
          <Text
            className="font-extrabold text-[13.5px] text-black"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatRupiah(item.sell_price)}
          </Text>
          <MotionPressable
            onPress={() => router.push(`/stok/${item.id}`)}
            accessibilityLabel={`Kelola stok ${item.name}`}
            className="h-7 w-7 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="plus" size={11} color="#09090B" solid />
          </MotionPressable>
        </View>
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

        {/* Soft Search Input */}
        <View className="mb-3 flex-row items-center gap-2.5 rounded-control bg-surface px-3.5 py-2.5">
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
            <Pressable onPress={() => setSearch('')} accessibilityLabel="Hapus pencarian" hitSlop={8}>
              <FontAwesome6 name="xmark" size={14} color="#71717A" solid />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View className="mb-3.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <MotionPressable
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
            </MotionPressable>

            <MotionPressable
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
            </MotionPressable>

            {categories.map((cat) => {
              const key: FilterMode = `cat:${cat}`;
              const active = filterMode === key;
              return (
                <MotionPressable
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
                </MotionPressable>
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
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
