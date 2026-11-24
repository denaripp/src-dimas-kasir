import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, View } from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { useAuth } from '@/hooks/useAuth';
import { printTestReceiptBluetooth } from '@/lib/printer';
import { usePrinterStore } from '@/store/usePrinterStore';

interface PrinterSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrinterSettingsModal({ visible, onClose }: PrinterSettingsModalProps) {
  const { store } = useAuth();
  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);
  const clearSelectedPrinter = usePrinterStore((s) => s.clearSelectedPrinter);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [isTestingPrint, setIsTestingPrint] = useState(false);

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      setPickerOpen(true);
      return;
    }

    setIsTestingPrint(true);
    try {
      await printTestReceiptBluetooth(
        {
          name: store?.name || 'SRC Dimas',
          paper_size: store?.paper_size ?? 58,
        },
        selectedPrinter.macAddress,
      );
      Alert.alert('Tes Cetak Berhasil', 'Slip tes cetak dikirim ke printer Bluetooth.');
    } catch (err) {
      Alert.alert(
        'Tes Cetak Gagal',
        err instanceof Error ? err.message : 'Printer Bluetooth tidak terhubung.',
      );
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Putuskan Printer',
      'Apakah Anda yakin ingin melepas printer thermal yang tersimpan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Putuskan',
          style: 'destructive',
          onPress: () => {
            void clearSelectedPrinter();
          },
        },
      ],
    );
  };

  return (
    <>
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
              <View className="flex-row items-center gap-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface">
                  <FontAwesome6 name="print" size={14} color="#09090B" solid />
                </View>
                <Text className="font-extrabold text-[15.5px] tracking-[-0.02em] text-black">
                  Printer Thermal
                </Text>
              </View>
              <MotionPressable
                onPress={onClose}
                accessibilityLabel="Tutup"
                className="h-8 w-8 items-center justify-center rounded-full bg-surface"
              >
                <FontAwesome6 name="xmark" size={12} color="#71717A" solid />
              </MotionPressable>
            </View>

            {/* Status Printer */}
            <View className="my-3 rounded-card border border-border bg-surface p-3.5">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-[11.5px] uppercase tracking-wider text-muted">
                    Printer Terpilih
                  </Text>
                  <Text className="mt-1 font-extrabold text-[14px] text-black" numberOfLines={1}>
                    {selectedPrinter ? selectedPrinter.deviceName : 'Belum Ada Printer'}
                  </Text>
                  <Text className="mt-0.5 font-medium text-[11.5px] text-muted">
                    {selectedPrinter
                      ? selectedPrinter.macAddress
                      : 'Hubungkan printer thermal Bluetooth untuk cetak struk otomatis.'}
                  </Text>
                </View>
                {selectedPrinter ? (
                  <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                    <View className="h-2 w-2 rounded-full bg-emerald-600" />
                    <Text className="font-bold text-[10.5px] text-emerald-800">
                      Tersimpan
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Actions */}
            <View className="gap-2.5">
              <MotionPressable
                onPress={() => setPickerOpen(true)}
                className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
              >
                <FontAwesome6 name="bluetooth" size={13} color="#09090B" />
                <Text className="font-bold text-[13px] text-black">
                  {selectedPrinter ? 'Ganti Printer' : 'Cari & Pilih Printer'}
                </Text>
              </MotionPressable>

              <MotionPressable
                onPress={() => void handleTestPrint()}
                disabled={isTestingPrint}
                className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
              >
                {isTestingPrint ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6 name="receipt" size={13} color="#FFFFFF" solid />
                )}
                <Text className="font-extrabold text-[13px] text-white">
                  {isTestingPrint ? 'Mengirim Data...' : 'Tes Cetak Struk'}
                </Text>
              </MotionPressable>

              {selectedPrinter ? (
                <MotionPressable
                  onPress={handleDisconnect}
                  className="min-h-[38px] items-center justify-center rounded-control py-2"
                >
                  <Text className="font-semibold text-[12px] text-muted">
                    Putuskan Hubungan Printer
                  </Text>
                </MotionPressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <PrinterPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
