import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';

const HIGHLIGHTS = [
  {
    icon: 'barcode' as const,
    title: 'Scan Kamera & Scanner HID',
    desc: 'Transaksi tunai 3 item selesai di bawah 20 detik.',
  },
  {
    icon: 'print' as const,
    title: 'Struk Thermal 58/80mm & PDF',
    desc: 'Cetak langsung via Bluetooth atau bagikan PDF ke WhatsApp.',
  },
  {
    icon: 'arrow-trend-up' as const,
    title: 'Stok & Laba Harian Akurat',
    desc: 'Stok anti minus, mutasi tercatat, laba bersih otomatis.',
  },
];

export default function LoginScreen() {
  const { signInWithGoogle, isSigningIn, authError, clearAuthError } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white px-[18px] py-6">
      <View className="flex-1 justify-between">
        {/* Brand Hero */}
        <View className="mt-4">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-[20px] bg-red">
            <FontAwesome6 name="store" size={26} color="#FFFFFF" solid />
          </View>

          <Text className="font-extrabold text-[28px] tracking-[-0.03em] text-black">
            src dimas kasir
          </Text>
          <Text className="mt-2 font-medium text-[14px] leading-5 text-black">
            Kasir cepat untuk warung dan toko retail harian. Stok sinkron, struk rapi, laba langsung terlihat.
          </Text>
        </View>

        {/* Feature Cards */}
        <View className="gap-3">
          {HIGHLIGHTS.map((item) => (
            <View
              key={item.title}
              className="flex-row items-center gap-3.5 rounded-card border-[1.5px] border-black bg-white p-3.5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name={item.icon} size={16} color="#FFFFFF" solid />
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-[14px] text-black">{item.title}</Text>
                <Text className="mt-0.5 font-medium text-[12px] text-black">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action & Error */}
        <View className="gap-3 pb-2">
          {authError ? (
            <View className="flex-row items-center justify-between gap-2 rounded-control bg-red px-4 py-3">
              <View className="flex-1 flex-row items-center gap-2.5">
                <FontAwesome6 name="triangle-exclamation" size={14} color="#FFFFFF" solid />
                <Text className="flex-1 font-semibold text-[12px] text-white">{authError}</Text>
              </View>
              <Pressable
                onPress={clearAuthError}
                accessibilityLabel="Tutup pesan error"
                hitSlop={8}
              >
                <FontAwesome6 name="xmark" size={14} color="#FFFFFF" solid />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={signInWithGoogle}
            disabled={isSigningIn}
            accessibilityRole="button"
            accessibilityLabel="Masuk dengan Google"
            className="flex-row items-center justify-center gap-3 rounded-control border-[1.5px] border-red bg-red px-5 py-4 active:opacity-90"
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="google" size={17} color="#FFFFFF" brand />
            )}
            <Text className="font-extrabold text-[15px] text-white">
              {isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google'}
            </Text>
          </Pressable>

          <Text className="text-center font-medium text-[11.5px] leading-4 text-black">
            Akun baru otomatis mendapat 1 toko sendiri dengan data terisolasi penuh.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
