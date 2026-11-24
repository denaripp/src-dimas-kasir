import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeSettings,
} from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarcodeScanConsensus } from '@/lib/barcode';

interface CameraBarcodeModalProps {
  visible: boolean;
  title?: string;
  closeOnScan?: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BARCODE_SCANNER_SETTINGS: BarcodeSettings = {
  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
};

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
});

export function CameraBarcodeModal({
  visible,
  title = 'Pindai Barcode',
  closeOnScan = true,
  onScan,
  onClose,
}: CameraBarcodeModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const consensusRef = useRef<BarcodeScanConsensus>(new BarcodeScanConsensus());
  const lockedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      consensusRef.current.reset();
      lockedRef.current = false;
      setScanLocked(false);
      setTorchOn(false);

      if (permission && !permission.granted && permission.canAskAgain) {
        void requestPermission();
      }
    } else {
      consensusRef.current.reset();
      lockedRef.current = false;
      setTorchOn(false);
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (lockedRef.current) return;

      const verifiedCode = consensusRef.current.feed(result.data, result.type);
      if (!verifiedCode) return;

      if (closeOnScan) {
        // Hard-lock sinkron agar thread kamera native tidak mengirim frame susulan saat modal menutup
        lockedRef.current = true;
        setScanLocked(true);
      }

      Vibration.vibrate(40);
      onScan(verifiedCode);
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
          <Pressable
            onPress={() => setTorchOn((prev) => !prev)}
            accessibilityLabel={torchOn ? 'Matikan senter' : 'Nyalakan senter'}
            className={`h-10 w-10 items-center justify-center rounded-full border-[1.5px] ${
              torchOn ? 'border-red bg-red' : 'border-border bg-surface'
            }`}
          >
            <FontAwesome6
              name="bolt"
              size={15}
              color={torchOn ? '#FFFFFF' : '#09090B'}
              solid
            />
          </Pressable>
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
              style={styles.camera}
              facing="back"
              autofocus="on"
              enableTorch={torchOn}
              barcodeScannerSettings={BARCODE_SCANNER_SETTINGS}
              onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Overlay */}
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center px-8"
            >
              <View className="h-44 w-full rounded-card border-[2.5px] border-red bg-transparent" />
              <View className="mt-4 rounded-chip bg-black/85 px-4 py-2">
                <Text className="font-semibold text-[12px] text-white">
                  Tahan barcode stabil di dalam kotak merah
                </Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
