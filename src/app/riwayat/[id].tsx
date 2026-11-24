import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { PrintFailureModal } from '@/components/printer/PrintFailureModal';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { useReceiptPrinter } from '@/hooks/useReceiptPrinter';
import { useSaleDetailQuery, useVoidSaleMutation } from '@/hooks/useSales';
import { formatDateTime, formatRupiah } from '@/lib/format';

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  scrollContent: {
    paddingBottom: 36,
  },
});

export default function SaleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: sale, isLoading } = useSaleDetailQuery(id);
  const voidMutation = useVoidSaleMutation();
  const printer = useReceiptPrinter({ successTitle: 'Cetak Ulang Berhasil' });

  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  const handleConfirmVoid = async () => {
    if (!sale) return;
    setVoidError(null);

    if (!voidReason.trim()) {
      setVoidError('Alasan pembatalan wajib diisi.');
      return;
    }

    try {
      await voidMutation.mutateAsync({
        saleId: sale.id,
        reason: voidReason,
      });
      setVoidModalOpen(false);
      setVoidReason('');
      Alert.alert(
        'Transaksi Di-Void',
        'Status transaksi berubah menjadi VOID dan seluruh stok item telah dikembalikan.',
      );
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Gagal membatalkan transaksi.');
    }
  };

  if (isLoading || !sale) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        {isLoading ? (
          <ActivityIndicator size="large" color="#D91E2A" />
        ) : (
          <View className="items-center gap-3">
            <Text className="font-bold text-[14px] text-black">
              Transaksi tidak ditemukan.
            </Text>
            <MotionPressable
              onPress={() => router.back()}
              className="rounded-control border border-border bg-white px-5 py-2.5"
            >
              <Text className="font-bold text-[13px] text-black">Kembali</Text>
            </MotionPressable>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const isVoid = sale.status === 'void';
  const receiptPayload = { sale, items: sale.sale_items ?? [] };
  const totalUnits = receiptPayload.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-[18px] py-3">
        <MotionPressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="chevron-left" size={14} color="#09090B" solid />
        </MotionPressable>
        <Text className="font-extrabold text-[16px] tracking-[-0.02em] text-black">
          Detail Struk
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Digital Receipt Card */}
        <View className="mb-4 rounded-card border border-border bg-white p-4">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <View
                className={`self-start rounded-[7px] px-2 py-0.5 ${
                  isVoid ? 'bg-red-soft' : 'bg-surface'
                }`}
              >
                <Text
                  className={`font-extrabold text-[10.5px] ${
                    isVoid ? 'text-red' : 'text-muted'
                  }`}
                >
                  {isVoid ? 'VOID · DIBATALKAN' : 'SELESAI · TUNAI'}
                </Text>
              </View>
              <Text
                className="mt-2 font-extrabold text-[18px] text-black"
                style={styles.tabular}
              >
                {sale.receipt_number}
              </Text>
              <Text className="mt-0.5 font-medium text-[12px] text-muted">
                {formatDateTime(sale.created_at)}
              </Text>
            </View>
            <View
              className={`h-9 w-9 items-center justify-center rounded-[11px] ${
                isVoid ? 'bg-red-soft' : 'bg-surface'
              }`}
            >
              <FontAwesome6
                name={isVoid ? 'ban' : 'receipt'}
                size={15}
                color={isVoid ? '#D91E2A' : '#09090B'}
                solid
              />
            </View>
          </View>

          {isVoid && sale.void_reason ? (
            <View className="mt-3 rounded-control bg-red-soft px-3 py-2.5">
              <Text className="font-bold text-[12px] text-red">
                Alasan Void: {sale.void_reason}
              </Text>
              {sale.voided_at ? (
                <Text className="mt-0.5 font-medium text-[11px] text-red">
                  Dibatalkan: {formatDateTime(sale.voided_at)}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="my-3.5 border-t border-dashed border-border" />

          {/* Rincian Item */}
          <View className="gap-2.5">
            {receiptPayload.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-[13.5px] text-black">
                    {item.product_name_snapshot}
                  </Text>
                  <Text
                    className="mt-0.5 font-medium text-[12px] text-muted"
                    style={styles.tabular}
                  >
                    {item.qty} × {formatRupiah(item.sell_price_snapshot)}
                  </Text>
                </View>
                <Text
                  className="font-bold text-[13.5px] text-black"
                  style={styles.tabular}
                >
                  {formatRupiah(item.subtotal)}
                </Text>
              </View>
            ))}
          </View>

          <View className="my-3.5 border-t border-dashed border-border" />

          {/* Total Breakdown */}
          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Text className="font-medium text-[12.5px] text-muted">Total Item</Text>
              <Text className="font-bold text-[12.5px] text-black" style={styles.tabular}>
                {receiptPayload.items.length} ({totalUnits} pcs)
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-extrabold text-[14.5px] text-black">Total</Text>
              <Text
                className={`font-extrabold text-[16.5px] ${
                  isVoid ? 'text-muted line-through' : 'text-black'
                }`}
                style={styles.tabular}
              >
                {formatRupiah(sale.total_amount)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-medium text-[12.5px] text-muted">Tunai Diterima</Text>
              <Text className="font-bold text-[12.5px] text-black" style={styles.tabular}>
                {formatRupiah(sale.cash_received)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-medium text-[12.5px] text-muted">Kembalian</Text>
              <Text className="font-extrabold text-[13px] text-red" style={styles.tabular}>
                {formatRupiah(sale.change_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="gap-2.5">
          <MotionPressable
            onPress={() => void printer.printBluetooth(receiptPayload)}
            disabled={printer.isPrinting}
            className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
          >
            {printer.isPrinting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="print" size={14} color="#FFFFFF" solid />
            )}
            <Text className="font-extrabold text-[13.5px] text-white">Cetak Ulang Struk</Text>
          </MotionPressable>

          <MotionPressable
            onPress={() => void printer.sharePdf(receiptPayload)}
            disabled={printer.isPrinting}
            className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
          >
            <FontAwesome6 name="file-pdf" size={14} color="#D91E2A" solid />
            <Text className="font-bold text-[13px] text-black">Bagikan PDF</Text>
          </MotionPressable>

          {!isVoid ? (
            <MotionPressable
              onPress={() => {
                setVoidError(null);
                setVoidReason('');
                setVoidModalOpen(true);
              }}
              className="mt-1 min-h-[44px] flex-row items-center justify-center gap-2 rounded-control bg-red-soft py-3"
            >
              <FontAwesome6 name="ban" size={14} color="#D91E2A" solid />
              <Text className="font-extrabold text-[13px] text-red">
                Void Transaksi (Batalkan)
              </Text>
            </MotionPressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Modal Konfirmasi Void (Lazy-mounted) */}
      {voidModalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setVoidModalOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 px-6">
            <View className="w-full rounded-hero border border-border bg-white p-5">
              <Text className="font-extrabold text-[17px] text-black">Void Transaksi?</Text>
              <Text className="mt-1 font-medium text-[12.5px] leading-5 text-muted">
                Pembatalan hanya dapat dilakukan 1 kali dan tidak dapat dikembalikan (no undo). Stok seluruh barang akan dikembalikan otomatis.
              </Text>

              <Text className="mb-1.5 mt-4 font-bold text-[12px] text-black">Alasan Void *</Text>
              <TextInput
                value={voidReason}
                onChangeText={(t) => {
                  setVoidReason(t);
                  setVoidError(null);
                }}
                placeholder="Contoh: Salah input barang / pembeli batal"
                placeholderTextColor="#71717A"
                className="rounded-control bg-surface px-3.5 py-2.5 font-semibold text-[13px] text-black"
              />

              {voidError ? (
                <Text className="mt-1.5 font-bold text-[12px] text-red">{voidError}</Text>
              ) : null}

              <View className="mt-4 gap-2">
                <MotionPressable
                  onPress={() => void handleConfirmVoid()}
                  disabled={voidMutation.isPending}
                  className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
                >
                  {voidMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome6 name="ban" size={13} color="#FFFFFF" solid />
                  )}
                  <Text className="font-extrabold text-[13.5px] text-white">
                    {voidMutation.isPending ? 'Memproses...' : 'Konfirmasi Void'}
                  </Text>
                </MotionPressable>

                <MotionPressable
                  onPress={() => setVoidModalOpen(false)}
                  className="min-h-[44px] items-center justify-center rounded-control border border-border bg-white py-3"
                >
                  <Text className="font-bold text-[13px] text-black">Batal</Text>
                </MotionPressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {printer.printError ? (
        <PrintFailureModal
          visible
          errorMessage={printer.printError}
          isBusy={printer.isPrinting}
          onRetry={() => void printer.printBluetooth(receiptPayload)}
          onChoosePrinter={printer.openPrinterPicker}
          onSharePdf={() => void printer.sharePdf(receiptPayload)}
          onClose={printer.clearPrintError}
        />
      ) : null}

      {printer.printerPickerOpen ? (
        <PrinterPickerModal
          visible
          onClose={printer.closePrinterPicker}
          onSelected={(selected) =>
            void printer.printBluetooth(receiptPayload, selected.macAddress)
          }
        />
      ) : null}
    </SafeAreaView>
  );
}
