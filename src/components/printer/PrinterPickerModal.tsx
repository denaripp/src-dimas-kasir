import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
          <Pressable
            onPress={onClose}
            accessibilityLabel="Tutup pilih printer"
            className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
          >
            <FontAwesome6 name="xmark" size={15} color="#09090B" solid />
          </Pressable>
          <Text className="font-extrabold text-[16px] text-black">
            Pilih Printer Bluetooth
          </Text>
          <Pressable
            onPress={() => void handleScan()}
            disabled={isScanning}
            accessibilityLabel="Pindai ulang printer"
            className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-red bg-red"
          >
            <FontAwesome6 name="rotate-right" size={14} color="#FFFFFF" solid />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-[18px]"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="mb-3.5 rounded-card border-[1.5px] border-black bg-white p-3.5">
            <Text className="font-bold text-[12px] text-black">
              Pastikan printer thermal (58mm/80mm) sudah menyala dan dipasangkan (paired) di pengaturan Bluetooth Android.
            </Text>
          </View>

          {scanError ? (
            <View className="mb-3.5 rounded-card bg-red p-4">
              <Text className="font-extrabold text-[13.5px] text-white">
                Gagal Memindai Printer
              </Text>
              <Text className="mt-1 font-medium text-[12px] text-white">
                {scanError}
              </Text>
            </View>
          ) : null}

          {isScanning ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#D91E2A" />
              <Text className="mt-3 font-semibold text-[12.5px] text-black">
                Mencari printer Bluetooth...
              </Text>
            </View>
          ) : devices.length === 0 ? (
            <View className="items-center rounded-card border-[1.5px] border-black bg-white p-6">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="print" size={18} color="#FFFFFF" solid />
              </View>
              <Text className="font-extrabold text-[14.5px] text-black">
                Belum Ada Printer Terdeteksi
              </Text>
              <Text className="mt-1 text-center font-medium text-[12px] text-black">
                Nyalakan Bluetooth, pasangkan printer di pengaturan Android, lalu tekan tombol pindai ulang.
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {devices.map((device) => {
                const isSelected = selectedPrinter?.macAddress === device.macAddress;
                return (
                  <Pressable
                    key={device.macAddress}
                    onPress={() => void handlePick(device)}
                    className={`flex-row items-center justify-between rounded-card border-[1.5px] px-4 py-3.5 ${
                      isSelected ? 'border-red bg-red' : 'border-black bg-white'
                    }`}
                  >
                    <View className="flex-1 pr-2">
                      <Text
                        className={`font-extrabold text-[14px] ${
                          isSelected ? 'text-white' : 'text-black'
                        }`}
                      >
                        {device.deviceName}
                      </Text>
                      <Text
                        className={`mt-0.5 font-medium text-[12px] ${
                          isSelected ? 'text-white' : 'text-black'
                        }`}
                      >
                        {device.macAddress}
                      </Text>
                    </View>
                    <FontAwesome6
                      name={isSelected ? 'check' : 'print'}
                      size={15}
                      color={isSelected ? '#FFFFFF' : '#09090B'}
                      solid
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
