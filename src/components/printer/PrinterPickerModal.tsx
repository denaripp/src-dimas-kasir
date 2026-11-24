import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  scanBluetoothPrinters,
  type BluetoothPrinterDevice,
} from '@/lib/printer';
import {
  usePrinterStore,
  type SavedBluetoothPrinter,
} from '@/store/usePrinterStore';

interface PrinterPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelected?: (printer: SavedBluetoothPrinter) => void;
}

export function PrinterPickerModal({
  visible,
  onClose,
  onSelected,
}: PrinterPickerModalProps) {
  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);
  const setSelectedPrinter = usePrinterStore((s) => s.setSelectedPrinter);

  const [devices, setDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const found = await scanBluetoothPrinters();
      setDevices(found);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Gagal memindai perangkat printer Bluetooth.',
      );
      setDevices([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void handleScan();
    }
  }, [visible, handleScan]);

  const handlePick = async (device: BluetoothPrinterDevice) => {
    const saved: SavedBluetoothPrinter = {
      deviceName: device.deviceName,
      macAddress: device.macAddress,
    };
    await setSelectedPrinter(saved);
    onSelected?.(saved);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-[18px] py-3">
          <MotionPressable
            onPress={onClose}
            accessibilityLabel="Tutup pilih printer"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="xmark" size={15} color="#09090B" solid />
          </MotionPressable>
          <Text className="font-extrabold text-[16px] text-black">
            Pilih Printer Bluetooth
          </Text>
          <MotionPressable
            onPress={() => void handleScan()}
            disabled={isScanning}
            accessibilityLabel="Pindai ulang printer"
            className="h-10 w-10 items-center justify-center rounded-full bg-red"
          >
            <FontAwesome6 name="rotate-right" size={14} color="#FFFFFF" solid />
          </MotionPressable>
        </View>

        <ScrollView
          className="flex-1 px-[18px]"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="mb-3.5 rounded-card bg-surface p-3.5">
            <Text className="font-medium text-[12px] leading-4 text-muted">
              Pastikan printer thermal (58mm/80mm) sudah menyala dan dipasangkan (paired) di pengaturan Bluetooth Android.
            </Text>
          </View>

          {scanError ? (
            <View className="mb-3.5 rounded-card bg-red-soft p-4">
              <Text className="font-extrabold text-[13.5px] text-red">
                Gagal Memindai Printer
              </Text>
              <Text className="mt-1 font-medium text-[12px] text-red">
                {scanError}
              </Text>
            </View>
          ) : null}

          {isScanning ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#D91E2A" />
              <Text className="mt-3 font-semibold text-[12.5px] text-muted">
                Mencari printer Bluetooth...
              </Text>
            </View>
          ) : devices.length === 0 ? (
            <View className="items-center rounded-card border border-border bg-white p-6">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
                <FontAwesome6 name="print" size={18} color="#D91E2A" solid />
              </View>
              <Text className="font-extrabold text-[14.5px] text-black">
                Belum Ada Printer Terdeteksi
              </Text>
              <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
                Nyalakan Bluetooth, pasangkan printer di pengaturan Android, lalu tekan tombol pindai ulang.
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-card border border-border bg-white">
              {devices.map((device, idx) => {
                const isSelected = selectedPrinter?.macAddress === device.macAddress;
                const isLast = idx === devices.length - 1;
                return (
                  <MotionPressable
                    key={device.macAddress}
                    onPress={() => void handlePick(device)}
                    scaleTo={0.985}
                    className={`flex-row items-center justify-between px-4 py-3.5 ${
                      !isLast ? 'border-b border-border' : ''
                    } ${isSelected ? 'bg-red-soft' : 'bg-white'}`}
                  >
                    <View className="flex-1 pr-2">
                      <Text
                        className={`font-bold text-[14px] ${
                          isSelected ? 'text-red' : 'text-black'
                        }`}
                      >
                        {device.deviceName}
                      </Text>
                      <Text className="mt-0.5 font-medium text-[12px] text-muted">
                        {device.macAddress}
                      </Text>
                    </View>
                    <View
                      className={`h-8 w-8 items-center justify-center rounded-full ${
                        isSelected ? 'bg-red' : 'bg-surface'
                      }`}
                    >
                      <FontAwesome6
                        name={isSelected ? 'check' : 'print'}
                        size={13}
                        color={isSelected ? '#FFFFFF' : '#09090B'}
                        solid
                      />
                    </View>
                  </MotionPressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
