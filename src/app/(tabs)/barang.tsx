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

  const renderItem = ({ item }: { item: ProductRow }) => {
    const isLowStock = item.stock <= item.min_stock;

    return (
      <Pressable
        onPress={() => router.push(`/barang/${item.id}`)}
        className="mb-2.5 flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] border-black bg-white px-3.5 py-3"
      >
        <View className="flex-1">
          <Text className="font-extrabold text-[14px] text-black" numberOfLines={1}>
            {item.name}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            <Text className="font-medium text-[12px] text-black">
              {item.barcode ? item.barcode : 'Tanpa barcode'}
            </Text>
            {item.category ? (
              <Text className="font-medium text-[12px] text-black">• {item.category}</Text>
            ) : null}
            <Text className="font-medium text-[12px] text-black">•</Text>
            <Text
              className={`text-[12px] ${
                isLowStock ? 'font-extrabold text-red' : 'font-semibold text-black'
              }`}
            >
              Stok {item.stock}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Text className="font-extrabold text-[13.5px] text-black">
            {formatRupiah(item.sell_price)}
          </Text>
          <Pressable
            onPress={() => router.push(`/stok/${item.id}`)}
            accessibilityLabel={`Kelola stok ${item.name}`}
            className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-black bg-white"
          >
            <FontAwesome6 name="plus" size={13} color="#09090B" solid />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3.5 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[18px] text-black">Barang &amp; Stok</Text>
            <Text className="font-medium text-[11.5px] text-black">
              {products.length} barang aktif • {lowStockCount} stok menipis
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/barang/csv')}
              accessibilityLabel="Import dan Export CSV Barang"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="file-arrow-up" size={15} color="#09090B" solid />
            </Pressable>
            <Pressable
              onPress={() => router.push('/barang/new')}
              accessibilityLabel="Tambah Barang Baru"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-red bg-red"
            >
              <FontAwesome6 name="plus" size={15} color="#FFFFFF" solid />
            </Pressable>
          </View>
        </View>

        {/* Search Input */}
        <View className="mb-3 flex-row items-center gap-2 rounded-control border-[1.5px] border-black bg-white px-3 py-2.5">
          <FontAwesome6 name="magnifying-glass" size={14} color="#09090B" solid />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama barang atau barcode..."
            placeholderTextColor="#09090B"
            className="flex-1 font-semibold text-[13px] text-black"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} accessibilityLabel="Hapus pencarian">
              <FontAwesome6 name="xmark" size={14} color="#09090B" solid />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Pressable
              onPress={() => setFilterMode('all')}
              className={`rounded-chip border-[1.5px] px-3 py-1.5 ${
                filterMode === 'all'
                  ? 'border-red bg-red'
                  : 'border-black bg-white'
              }`}
            >
              <Text
                className={`font-bold text-[11.5px] ${
                  filterMode === 'all' ? 'text-white' : 'text-black'
                }`}
              >
                Semua ({products.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterMode('low_stock')}
              className={`rounded-chip border-[1.5px] px-3 py-1.5 ${
                filterMode === 'low_stock'
                  ? 'border-red bg-red'
                  : 'border-black bg-white'
              }`}
            >
              <Text
                className={`font-bold text-[11.5px] ${
                  filterMode === 'low_stock' ? 'text-white' : 'text-black'
                }`}
              >
                Stok Menipis ({lowStockCount})
              </Text>
            </Pressable>

            {categories.map((cat) => {
              const key: FilterMode = `cat:${cat}`;
              const active = filterMode === key;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setFilterMode(key)}
                  className={`rounded-chip border-[1.5px] px-3 py-1.5 ${
                    active ? 'border-red bg-red' : 'border-black bg-white'
                  }`}
                >
                  <Text
                    className={`font-bold text-[11.5px] ${
                      active ? 'text-white' : 'text-black'
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
                  <FontAwesome6 name="cube" size={18} color="#FFFFFF" solid />
                </View>
                <Text className="text-center font-extrabold text-[15px] text-black">
                  {products.length === 0 ? 'Belum Ada Barang' : 'Barang Tidak Ditemukan'}
                </Text>
                <Text className="mt-1 text-center font-medium text-[12px] text-black">
                  {products.length === 0
                    ? 'Tambah barang satu per satu atau impor sekaligus lewat file CSV.'
                    : 'Coba ubah kata kunci pencarian atau filter kategori.'}
                </Text>
                {products.length === 0 ? (
                  <Pressable
                    onPress={() => router.push('/barang/new')}
                    className="mt-4 rounded-control bg-red px-5 py-3"
                  >
                    <Text className="font-extrabold text-[13px] text-white">
                      Tambah Barang Pertama
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
