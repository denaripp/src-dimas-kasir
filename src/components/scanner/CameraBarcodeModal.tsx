import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CameraBarcodeModalProps {
  visible: boolean;
  title?: string;
  closeOnScan?: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const SCAN_DEBOUNCE_MS = 1200;

export function CameraBarcodeModal({
  visible,
  title = 'Pindai Barcode',
  closeOnScan = true,
  onScan,
  onClose,
}: CameraBarcodeModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      const code = result.data?.trim();
      if (!code) return;

      const now = Date.now();
      if (
        lastScanRef.current.code === code &&
        now - lastScanRef.current.at < SCAN_DEBOUNCE_MS
      ) {
        return;
      }

      lastScanRef.current = { code, at: now };
      Vibration.vibrate(40);
      onScan(code);
      if (closeOnScan) {
        onClose();
      }
    },
    [closeOnScan, onClose, onScan],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-white px-[18px] py-3.5">
          <Pressable
            onPress={onClose}
            accessibilityLabel="Tutup kamera"
            className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
          >
            <FontAwesome6 name="xmark" size={16} color="#09090B" solid />
          </Pressable>
          <Text className="font-extrabold text-[16px] text-black">{title}</Text>
          <View className="h-10 w-10" />
        </View>

        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center bg-white px-6">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-red">
              <FontAwesome6 name="camera" size={24} color="#FFFFFF" solid />
            </View>
            <Text className="text-center font-extrabold text-[16px] text-black">
              Izin Kamera Diperlukan
            </Text>
            <Text className="mt-2 text-center font-medium text-[13px] text-black">
              Izinkan akses kamera agar aplikasi dapat memindai barcode barang secara langsung.
            </Text>
            <Pressable
              onPress={() => void requestPermission()}
              className="mt-5 rounded-control bg-red px-6 py-3.5"
            >
              <Text className="font-extrabold text-[13.5px] text-white">Izinkan Kamera</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Viewfinder Overlay */}
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center px-8"
            >
              <View className="h-44 w-full rounded-card border-[2.5px] border-red bg-transparent" />
              <View className="mt-4 rounded-chip bg-black px-4 py-2">
                <Text className="font-semibold text-[12px] text-white">
                  Arahkan barcode ke dalam kotak merah
                </Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
