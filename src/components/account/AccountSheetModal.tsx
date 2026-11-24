import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { Alert, Modal, Text, View } from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useAuth } from '@/hooks/useAuth';

interface AccountSheetModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AccountSheetModal({ visible, onClose }: AccountSheetModalProps) {
  const { user, store, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari aplikasi kasir SRC Dimas?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await signOut();
          },
        },
      ],
    );
  };

  const storeName = store?.name || 'SRC Dimas';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <View className="w-full max-w-[360px] rounded-hero border border-border bg-white p-5">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3">
            <Text className="font-extrabold text-[15.5px] tracking-[-0.02em] text-black">
              Akun Kasir
            </Text>
            <MotionPressable
              onPress={onClose}
              accessibilityLabel="Tutup"
              className="h-8 w-8 items-center justify-center rounded-full bg-surface"
            >
              <FontAwesome6 name="xmark" size={12} color="#71717A" solid />
            </MotionPressable>
          </View>

          {/* Profil Info */}
          <View className="my-3 flex-row items-center gap-3.5 rounded-card border border-border bg-surface p-4">
            {store?.logo_url ? (
              <Image
                source={store.logo_url}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#E4E4E7',
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-black">
                <Text className="font-extrabold text-[16px] text-white">
                  {storeName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="flex-1">
              <Text className="font-extrabold text-[15px] text-black" numberOfLines={1}>
                {storeName}
              </Text>
              <Text className="mt-0.5 font-medium text-[12px] text-muted" numberOfLines={1}>
                {user?.email ?? '-'}
              </Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full bg-emerald-600" />
                <Text className="font-semibold text-[11px] text-emerald-800">
                  Kasir Pribadi (Aktif)
                </Text>
              </View>
            </View>
          </View>

          {/* Action Logout */}
          <View className="mt-2 gap-2.5">
            <MotionPressable
              onPress={handleLogout}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
            >
              <FontAwesome6 name="right-from-bracket" size={13} color="#FFFFFF" solid />
              <Text className="font-extrabold text-[13px] text-white">
                Keluar (Logout)
              </Text>
            </MotionPressable>

            <MotionPressable
              onPress={onClose}
              className="min-h-[40px] items-center justify-center rounded-control border border-border bg-white py-2.5"
            >
              <Text className="font-bold text-[12.5px] text-black">Tutup</Text>
            </MotionPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
