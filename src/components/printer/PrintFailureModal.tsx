import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

interface PrintFailureModalProps {
  visible: boolean;
  errorMessage: string | null;
  isBusy?: boolean;
  onRetry: () => void;
  onChoosePrinter: () => void;
  onSharePdf: () => void;
  onClose: () => void;
}

/**
 * Dialog gagal cetak tepat sesuai PRD 3.7:
 * Transaksi tetap tersimpan; tampil 3 tombol:
 * 1. Coba lagi
 * 2. Pilih printer lain
 * 3. Bagikan sebagai PDF
 */
export function PrintFailureModal({
  visible,
  errorMessage,
  isBusy = false,
  onRetry,
  onChoosePrinter,
  onSharePdf,
  onClose,
}: PrintFailureModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
          <View className="mb-3 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-red">
              <FontAwesome6 name="triangle-exclamation" size={18} color="#FFFFFF" solid />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-[16px] text-black">
                Gagal Mencetak Struk
              </Text>
              <Text className="font-semibold text-[11.5px] text-black">
                Transaksi tetap tersimpan aman.
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View className="mb-4 rounded-control border-[1.5px] border-dashed border-black bg-white px-3.5 py-2.5">
              <Text className="font-medium text-[12px] text-black">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="gap-2.5">
            <Pressable
              onPress={onRetry}
              disabled={isBusy}
              className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-red bg-red py-3.5"
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="rotate-right" size={13} color="#FFFFFF" solid />
              )}
              <Text className="font-extrabold text-[13.5px] text-white">Coba lagi</Text>
            </Pressable>

            <Pressable
              onPress={onChoosePrinter}
              disabled={isBusy}
              className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3.5"
            >
              <FontAwesome6 name="print" size={13} color="#09090B" solid />
              <Text className="font-extrabold text-[13.5px] text-black">
                Pilih printer lain
              </Text>
            </Pressable>

            <Pressable
              onPress={onSharePdf}
              disabled={isBusy}
              className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3.5"
            >
              <FontAwesome6 name="file-pdf" size={13} color="#D91E2A" solid />
              <Text className="font-extrabold text-[13.5px] text-black">
                Bagikan sebagai PDF
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={isBusy}
              className="items-center py-2"
            >
              <Text className="font-bold text-[12.5px] text-black">Tutup</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
