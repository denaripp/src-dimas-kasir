import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { formatRupiah } from '@/lib/format';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function DashboardScreen() {
  const router = useRouter();
  const { store, signOut } = useAuth();
  const storeName = store?.name ?? 'Toko Saya';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <ScrollView
        className="flex-1 bg-white px-[18px]"
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-black">
              <Text className="font-extrabold text-[14px] text-white">
                {getInitials(storeName)}
              </Text>
            </View>
            <View>
              <Text className="font-medium text-[11px] text-black">Selamat datang!</Text>
              <Text className="font-extrabold text-[15px] text-black">{storeName}</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/(tabs)/kasir')}
              accessibilityLabel="Buka Kasir"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="print" size={15} color="#09090B" solid />
            </Pressable>
            <Pressable
              onPress={signOut}
              accessibilityLabel="Keluar Akun"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="right-from-bracket" size={15} color="#09090B" solid />
            </Pressable>
          </View>
        </View>

        {/* Hero Summary Card */}
        <View className="mb-3.5 flex-row items-center justify-between gap-3 rounded-hero bg-red px-5 py-[18px]">
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
                <FontAwesome6 name="rupiah-sign" size={12} color="#D91E2A" solid />
              </View>
              <Text className="font-semibold text-[11.5px] text-white">Penjualan Hari Ini</Text>
            </View>
            <Text className="font-extrabold text-[22px] tracking-[-0.03em] text-white">
              {formatRupiah(0)}
            </Text>
            <Text className="mt-1 font-medium text-[11.5px] text-white">
              Tunai • 0 transaksi selesai
            </Text>
          </View>

          <View className="h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-white">
            <Text className="font-extrabold text-[18px] text-white">0</Text>
            <Text className="font-semibold text-[10px] text-white">struk</Text>
          </View>
        </View>

        {/* 2-Column KPI Cards */}
        <View className="mb-3.5 flex-row gap-3">
          <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
            <View className="mb-3 flex-row items-start justify-between">
              <Text className="font-semibold text-[12.5px] leading-4 text-black">
                {'Laba\nKotor'}
              </Text>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="arrow-trend-up" size={15} color="#FFFFFF" solid />
              </View>
            </View>
            <Text className="font-extrabold text-[17px] text-black">{formatRupiah(0)}</Text>
            <Text className="mt-0.5 font-medium text-[11px] text-black">hari ini</Text>
          </View>

          <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
            <View className="mb-3 flex-row items-start justify-between">
              <Text className="font-semibold text-[12.5px] leading-4 text-black">
                {'Laba\nBersih'}
              </Text>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="wallet" size={15} color="#FFFFFF" solid />
              </View>
            </View>
            <Text className="font-extrabold text-[17px] text-black">{formatRupiah(0)}</Text>
            <Text className="mt-0.5 font-medium text-[11px] text-black">
              biaya {formatRupiah(0)}
            </Text>
          </View>
        </View>

        {/* Quick Action CTA to Kasir */}
        <Pressable
          onPress={() => router.push('/(tabs)/kasir')}
          accessibilityRole="button"
          className="mb-4 flex-row items-center justify-center gap-2.5 rounded-control border-[1.5px] border-red bg-red py-3.5"
        >
          <FontAwesome6 name="barcode" size={16} color="#FFFFFF" solid />
          <Text className="font-extrabold text-[14px] text-white">Mulai Transaksi Kasir</Text>
        </Pressable>

        {/* Empty State Placeholder Cards (Wired with live queries in Phase 7) */}
        <View className="rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="font-extrabold text-[13.5px] text-black">
            Ringkasan Operasional Siap
          </Text>
          <Text className="mt-1 font-medium text-[12px] text-black">
            Data stok menipis dan 5 transaksi terakhir akan tampil otomatis setelah barang & transaksi mulai dicatat.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
