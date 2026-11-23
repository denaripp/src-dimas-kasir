import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RiwayatScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white px-[18px] pt-3">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-extrabold text-[18px] text-black">Riwayat Realtime</Text>
        <View className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white">
          <FontAwesome6 name="print" size={15} color="#09090B" solid />
        </View>
      </View>

      <View className="rounded-card border-[1.5px] border-black bg-white p-4">
        <Text className="font-extrabold text-[14px] text-black">Daftar Transaksi</Text>
        <Text className="mt-1 font-medium text-[12px] text-black">
          Langganan Supabase Realtime, cetak ulang struk, bagikan PDF, dan pembatalan Void akan diaktifkan pada Phase 7.
        </Text>
      </View>
    </SafeAreaView>
  );
}
