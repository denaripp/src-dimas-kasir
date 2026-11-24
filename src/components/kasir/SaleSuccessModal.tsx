import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { memo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { CreateSaleAtomicResult } from '@/types/database';

interface SaleSuccessModalProps {
  saleResult: CreateSaleAtomicResult;
  isPrinting: boolean;
  onPrintBluetooth: () => void;
  onSharePdf: () => void;
  onClose: () => void;
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});

export const SaleSuccessModal = memo(function SaleSuccessModal({
  saleResult,
  isPrinting,
  onPrintBluetooth,
  onSharePdf,
  onClose,
}: SaleSuccessModalProps) {
  const { sale } = saleResult;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-hero border border-border bg-white p-5">
          <View className="mb-3.5 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-red">
              <FontAwesome6 name="check" size={18} color="#FFFFFF" solid />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-[16px] text-black">
                Transaksi Tersimpan
              </Text>
              <Text
                className="mt-0.5 font-semibold text-[12px] text-muted"
                style={styles.tabular}
              >
                {sale.receipt_number}
              </Text>
            </View>
          </View>

          <View className="mb-4 rounded-card bg-surface p-3.5">
            <View className="mb-1.5 flex-row justify-between">
              <Text className="font-medium text-[12px] text-muted">Waktu</Text>
              <Text className="font-bold text-[12px] text-black">
                {formatDateTime(sale.created_at)}
              </Text>
            </View>
            <View className="mb-1.5 flex-row justify-between">
              <Text className="font-medium text-[12px] text-muted">Total</Text>
              <Text
                className="font-extrabold text-[13px] text-black"
                style={styles.tabular}
              >
                {formatRupiah(sale.total_amount)}
              </Text>
            </View>
            <View className="mb-1.5 flex-row justify-between">
              <Text className="font-medium text-[12px] text-muted">Tunai</Text>
              <Text
                className="font-bold text-[12.5px] text-black"
                style={styles.tabular}
              >
                {formatRupiah(sale.cash_received)}
              </Text>
            </View>
            <View className="flex-row justify-between border-t border-dashed border-border pt-2">
              <Text className="font-bold text-[13px] text-black">Kembalian</Text>
              <Text
                className="font-extrabold text-[15px] text-red"
                style={styles.tabular}
              >
                {formatRupiah(sale.change_amount)}
              </Text>
            </View>
          </View>

          <View className="gap-2.5">
            <MotionPressable
              onPress={onPrintBluetooth}
              disabled={isPrinting}
              className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="print" size={14} color="#FFFFFF" solid />
              )}
              <Text className="font-extrabold text-[13.5px] text-white">
                {isPrinting ? 'Mencetak...' : 'Cetak Struk Bluetooth'}
              </Text>
            </MotionPressable>

            <MotionPressable
              onPress={onSharePdf}
              disabled={isPrinting}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
            >
              <FontAwesome6 name="file-pdf" size={14} color="#D91E2A" solid />
              <Text className="font-bold text-[13px] text-black">
                Bagikan PDF (WhatsApp)
              </Text>
            </MotionPressable>

            <MotionPressable onPress={onClose} className="items-center py-2.5">
              <Text className="font-bold text-[13px] text-muted">Transaksi Baru</Text>
            </MotionPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});
