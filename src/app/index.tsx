import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatLocalDateKey, formatReceiptNumber, formatRupiah } from '@/lib/format';

export default function IndexScreen() {
  const sampleReceipt = formatReceiptNumber(formatLocalDateKey(), 1);

  return (
    <SafeAreaView className="flex-1 bg-white px-[18px] pt-4">
      <View className="rounded-hero bg-red p-5">
        <View className="mb-2 flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
            <FontAwesome6 name="rupiah-sign" size={12} color="#D91E2A" solid />
          </View>
          <Text className="font-semibold text-xs text-white">src dimas kasir v0.1.0</Text>
        </View>
        <Text className="font-extrabold text-[21px] text-white">{formatRupiah(0)}</Text>
        <Text className="mt-1 font-medium text-xs text-white">
          Fondasi Phase 1 siap • Struk {sampleReceipt}
        </Text>
      </View>
    </SafeAreaView>
  );
}
