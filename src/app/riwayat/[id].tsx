import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrintFailureModal } from '@/components/printer/PrintFailureModal';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { useAuth } from '@/hooks/useAuth';
import { useSaleDetailQuery, useVoidSaleMutation } from '@/hooks/useSales';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { printReceiptBluetooth } from '@/lib/printer';
import { shareReceiptPdf } from '@/lib/receiptPdf';
import { usePrinterStore } from '@/store/usePrinterStore';

export default function SaleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useAuth();
  const { data: sale, isLoading } = useSaleDetailQuery(id);
  const voidMutation = useVoidSaleMutation();

  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);
  const hydratePrinter = usePrinterStore((s) => s.hydrate);

  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);

  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    void hydratePrinter();
  }, [hydratePrinter]);

  const buildStoreInfo = useCallback(
    () => ({
      name: store?.name ?? 'Toko Saya',
      address: store?.address ?? '',
      phone: store?.phone ?? '',
      logo_url: store?.logo_url ?? null,
      receipt_footer: store?.receipt_footer ?? 'Terima kasih telah berbelanja!',
      paper_size: store?.paper_size ?? (58 as const),
    }),
    [store],
  );

  const handlePrint = async (macOverride?: string) => {
    if (!sale) return;
    const mac = macOverride ?? selectedPrinter?.macAddress;
    if (!mac) {
      setPrintError('Printer Bluetooth belum dipilih.');
      return;
    }

    setIsPrinting(true);
    setPrintError(null);
    try {
      await printReceiptBluetooth(sale, sale.sale_items ?? [], buildStoreInfo(), mac);
      Alert.alert('Cetak Ulang Berhasil', `Struk ${sale.receipt_number} dikirim ke printer.`);
    } catch (err) {
      setPrintError(
        err instanceof Error ? err.message : 'Gagal mencetak ke printer Bluetooth.',
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSharePdf = async () => {
    if (!sale) return;
    setIsPrinting(true);
    try {
      await shareReceiptPdf(sale, sale.sale_items ?? [], buildStoreInfo());
      setPrintError(null);
    } catch (err) {
      Alert.alert(
        'Gagal Bagikan PDF',
        err instanceof Error ? err.message : 'Tidak dapat membuat PDF struk.',
      );
    } finally {
      setIsPrinting(false);
    }
  };

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
            <Pressable
              onPress={() => router.back()}
              className="rounded-control border-[1.5px] border-black bg-white px-5 py-2.5"
            >
              <Text className="font-extrabold text-[13px] text-black">Kembali</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const isVoid = sale.status === 'void';

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-[18px] py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="chevron-left" size={15} color="#09090B" solid />
        </Pressable>
        <Text className="font-extrabold text-[16px] text-black">Detail Struk</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status / Header Card */}
        <View
          className={`mb-4 rounded-hero p-5 ${
            isVoid ? 'bg-red' : 'border-[1.5px] border-black bg-white'
          }`}
        >
          <Text
            className={`font-extrabold text-[11px] uppercase ${
              isVoid ? 'text-white' : 'text-red'
            }`}
          >
            {isVoid ? 'STATUS: VOID (DIBATALKAN)' : 'STATUS: SELESAI (TUNAI)'}
          </Text>
          <Text
            className={`mt-1 font-extrabold text-[19px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
          >
            {sale.receipt_number}
          </Text>
          <Text
            className={`mt-0.5 font-medium text-[12px] ${
              isVoid ? 'text-white' : 'text-black'
            }`}
          >
            {formatDateTime(sale.created_at)}
          </Text>

          {isVoid && sale.void_reason ? (
            <View className="mt-3 rounded-control border-[1.5px] border-white px-3 py-2">
              <Text className="font-bold text-[11.5px] text-white">
                Alasan Void: {sale.void_reason}
              </Text>
              {sale.voided_at ? (
                <Text className="mt-0.5 font-medium text-[11px] text-white">
                  Dibatalkan: {formatDateTime(sale.voided_at)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Itemized Receipt Card */}
        <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="mb-3 font-extrabold text-[14px] text-black">Rincian Item</Text>

          <View className="gap-2.5">
            {(sale.sale_items ?? []).map((item) => (
              <View
                key={item.id}
                className="flex-row items-center justify-between border-b border-dashed border-black pb-2.5"
              >
                <View className="flex-1 pr-2">
                  <Text className="font-extrabold text-[13.5px] text-black">
                    {item.product_name_snapshot}
                  </Text>
                  <Text className="mt-0.5 font-medium text-[12px] text-black">
                    {item.qty} × {formatRupiah(item.sell_price_snapshot)}
                  </Text>
                </View>
                <Text className="font-extrabold text-[13.5px] text-black">
                  {formatRupiah(item.subtotal)}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-3 gap-1.5">
            <View className="flex-row justify-between">
              <Text className="font-extrabold text-[15px] text-black">Total</Text>
              <Text
                className={`font-extrabold text-[16px] text-black ${
                  isVoid ? 'line-through' : ''
                }`}
              >
                {formatRupiah(sale.total_amount)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-medium text-[12.5px] text-black">Tunai Diterima</Text>
              <Text className="font-bold text-[12.5px] text-black">
                {formatRupiah(sale.cash_received)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-medium text-[12.5px] text-black">Kembalian</Text>
              <Text className="font-extrabold text-[13px] text-red">
                {formatRupiah(sale.change_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="gap-2.5">
          <Pressable
            onPress={() => void handlePrint()}
            disabled={isPrinting}
            className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="print" size={14} color="#FFFFFF" solid />
            )}
            <Text className="font-extrabold text-[13.5px] text-white">Cetak Ulang Struk</Text>
          </Pressable>

          <Pressable
            onPress={() => void handleSharePdf()}
            disabled={isPrinting}
            className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3.5"
          >
            <FontAwesome6 name="file-pdf" size={14} color="#D91E2A" solid />
            <Text className="font-extrabold text-[13.5px] text-black">Bagikan PDF</Text>
          </Pressable>

          {/* Void Button — hanya muncul jika status masih completed (1x, no undo) */}
          {!isVoid ? (
            <Pressable
              onPress={() => {
                setVoidError(null);
                setVoidReason('');
                setVoidModalOpen(true);
              }}
              className="mt-2 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-red bg-white py-3.5"
            >
              <FontAwesome6 name="ban" size={14} color="#D91E2A" solid />
              <Text className="font-extrabold text-[13.5px] text-red">
                Void Transaksi (Batalkan)
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Modal Konfirmasi Void (Alasan Wajib — PRD 3.12) */}
      <Modal
        visible={voidModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVoidModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
            <Text className="font-extrabold text-[17px] text-black">Void Transaksi?</Text>
            <Text className="mt-1 font-medium text-[12.5px] text-black">
              Pembatalan hanya dapat dilakukan 1 kali dan tidak dapat dikembalikan (no undo). Stok seluruh barang akan dikembalikan otomatis.
            </Text>

            <Text className="mb-1.5 mt-4 font-bold text-[12px] text-black">
              Alasan Void *
            </Text>
            <TextInput
              value={voidReason}
              onChangeText={(t) => {
                setVoidReason(t);
                setVoidError(null);
              }}
              placeholder="Contoh: Salah input barang / pembeli batal"
              placeholderTextColor="#09090B"
              className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-semibold text-[13px] text-black"
            />

            {voidError ? (
              <Text className="mt-1.5 font-bold text-[12px] text-red">{voidError}</Text>
            ) : null}

            <View className="mt-4 gap-2">
              <Pressable
                onPress={() => void handleConfirmVoid()}
                disabled={voidMutation.isPending}
                className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
              >
                {voidMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6 name="ban" size={13} color="#FFFFFF" solid />
                )}
                <Text className="font-extrabold text-[13.5px] text-white">
                  {voidMutation.isPending ? 'Memproses...' : 'Konfirmasi Void'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setVoidModalOpen(false)}
                className="items-center rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <Text className="font-extrabold text-[13px] text-black">Batal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PrintFailureModal
        visible={Boolean(printError)}
        errorMessage={printError}
        isBusy={isPrinting}
        onRetry={() => void handlePrint()}
        onChoosePrinter={() => {
          setPrintError(null);
          setPrinterPickerOpen(true);
        }}
        onSharePdf={() => void handleSharePdf()}
        onClose={() => setPrintError(null)}
      />

      <PrinterPickerModal
        visible={printerPickerOpen}
        onClose={() => setPrinterPickerOpen(false)}
        onSelected={(printer) => void handlePrint(printer.macAddress)}
      />
    </SafeAreaView>
  );
}
