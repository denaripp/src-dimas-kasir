import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrintFailureModal } from '@/components/printer/PrintFailureModal';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { CameraBarcodeModal } from '@/components/scanner/CameraBarcodeModal';
import { HidScannerInput } from '@/components/scanner/HidScannerInput';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProductsQuery } from '@/hooks/useProducts';
import { useCreateSaleMutation } from '@/hooks/useSales';
import {
  calculateCartItemCount,
  calculateCartTotal,
  calculateChange,
  validateCartStock,
} from '@/lib/cartCalc';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { printReceiptBluetooth } from '@/lib/printer';
import { shareReceiptPdf } from '@/lib/receiptPdf';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import type { CreateSaleAtomicResult, ProductRow } from '@/types/database';

export default function KasirScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { store } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: products = [] } = useProductsQuery(store?.id);
  const createSaleMutation = useCreateSaleMutation();

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const syncProductStocks = useCartStore((s) => s.syncProductStocks);
  const clearCart = useCartStore((s) => s.clearCart);

  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);
  const hydratePrinter = usePrinterStore((s) => s.hydrate);

  const [search, setSearch] = useState('');
  const [cashText, setCashText] = useState('');
  const [isTypingInput, setIsTypingInput] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<CreateSaleAtomicResult | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);

  useEffect(() => {
    void hydratePrinter();
  }, [hydratePrinter]);

  useEffect(() => {
    if (products.length > 0) {
      syncProductStocks(products);
    }
  }, [products, syncProductStocks]);

  const totalAmount = useMemo(() => calculateCartTotal(items), [items]);
  const totalQty = useMemo(() => calculateCartItemCount(items), [items]);

  const parsedCash = Number.parseInt(cashText.trim(), 10);
  const cashReceived = Number.isInteger(parsedCash) && parsedCash >= 0 ? parsedCash : 0;
  const changeState = useMemo(
    () => calculateChange(totalAmount, cashReceived),
    [totalAmount, cashReceived],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [products, search]);

  const handleAddProduct = useCallback(
    (product: ProductRow) => {
      setBannerError(null);
      const res = addItem(product);
      if (!res.ok) {
        setBannerError(res.error ?? 'Stok barang tidak cukup.');
        Vibration.vibrate(80);
        return;
      }
      setSearch('');
    },
    [addItem],
  );

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const cleaned = barcode.trim();
      if (!cleaned) return;

      const found = products.find(
        (p) => (p.barcode ?? '').trim().toLowerCase() === cleaned.toLowerCase(),
      );

      if (!found) {
        Vibration.vibrate([0, 60, 60, 60]);
        setCameraOpen(false);
        setNotFoundBarcode(cleaned);
        return;
      }

      handleAddProduct(found);
    },
    [products, handleAddProduct],
  );

  const handleStepQty = (productId: string, nextQty: number) => {
    setBannerError(null);
    const res = updateQty(productId, nextQty);
    if (!res.ok && res.error) {
      setBannerError(res.error);
    }
  };

  const handleCheckout = async () => {
    setBannerError(null);

    if (!isOnline) {
      setBannerError('Koneksi internet terputus. Transaksi hanya bisa diproses saat online.');
      return;
    }

    if (items.length === 0) {
      setBannerError('Keranjang masih kosong.');
      return;
    }

    const stockError = validateCartStock(items);
    if (stockError) {
      setBannerError(stockError);
      return;
    }

    if (!changeState.isEnough) {
      setBannerError(
        `Uang diterima masih kurang ${formatRupiah(changeState.shortfall)}.`,
      );
      return;
    }

    try {
      const result = await createSaleMutation.mutateAsync({
        cashReceived,
        items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
      });
      clearCart();
      setCashText('');
      setLastSale(result);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Transaksi gagal diproses.');
    }
  };

  const buildFallbackStore = useCallback(
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

  const handlePrintBluetooth = useCallback(
    async (saleData: CreateSaleAtomicResult, macOverride?: string) => {
      const mac = macOverride ?? selectedPrinter?.macAddress;
      if (!mac) {
        setPrintError('Printer Bluetooth belum dipilih atau belum terhubung.');
        return;
      }

      setIsPrinting(true);
      setPrintError(null);
      try {
        await printReceiptBluetooth(
          saleData.sale,
          saleData.items,
          buildFallbackStore(),
          mac,
        );
        Alert.alert('Struk Dicetak', `Struk ${saleData.sale.receipt_number} dikirim ke printer.`);
      } catch (err) {
        setPrintError(
          err instanceof Error
            ? err.message
            : 'Printer Bluetooth tidak merespons atau terputus.',
        );
      } finally {
        setIsPrinting(false);
      }
    },
    [selectedPrinter, buildFallbackStore],
  );

  const handleSharePdf = useCallback(
    async (saleData: CreateSaleAtomicResult) => {
      setIsPrinting(true);
      try {
        await shareReceiptPdf(saleData.sale, saleData.items, buildFallbackStore());
        setPrintError(null);
      } catch (err) {
        Alert.alert(
          'Gagal Bagikan PDF',
          err instanceof Error ? err.message : 'Tidak dapat membuat file PDF struk.',
        );
      } finally {
        setIsPrinting(false);
      }
    },
    [buildFallbackStore],
  );

  const hidEnabled =
    isFocused &&
    !isTypingInput &&
    !cameraOpen &&
    !notFoundBarcode &&
    !lastSale &&
    !printerPickerOpen &&
    !printError;

  const canPay =
    isOnline &&
    items.length > 0 &&
    changeState.isEnough &&
    !createSaleMutation.isPending;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <HidScannerInput enabled={hidEnabled} onScan={handleBarcodeDetected} />

      <View className="flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[18px] text-black">Kasir Tunai</Text>
            <View className="mt-0.5 flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <FontAwesome6 name="barcode" size={11} color="#09090B" solid />
                <Text className="font-semibold text-[11px] text-black">
                  HID: {hidEnabled ? 'Siap' : 'Jeda'}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <FontAwesome6
                  name="wifi"
                  size={11}
                  color={isOnline ? '#09090B' : '#D91E2A'}
                  solid
                />
                <Text
                  className={`font-extrabold text-[11px] ${
                    isOnline ? 'text-black' : 'text-red'
                  }`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {items.length > 0 ? (
              <Pressable
                onPress={() => {
                  clearCart();
                  setCashText('');
                  setBannerError(null);
                }}
                accessibilityLabel="Kosongkan keranjang"
                className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
              >
                <FontAwesome6 name="trash" size={14} color="#09090B" solid />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setCameraOpen(true)}
              accessibilityLabel="Pindai barcode dengan kamera"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-red bg-red"
            >
              <FontAwesome6 name="camera" size={15} color="#FFFFFF" solid />
            </Pressable>
          </View>
        </View>

        {/* Offline Warning Banner (Online-First PRD 5.2) */}
        {!isOnline ? (
          <View className="mb-3 flex-row items-center gap-2.5 rounded-control bg-red px-3.5 py-2.5">
            <FontAwesome6 name="triangle-exclamation" size={14} color="#FFFFFF" solid />
            <Text className="flex-1 font-bold text-[12px] text-white">
              Koneksi internet terputus. Tombol bayar ditahan hingga perangkat kembali online.
            </Text>
          </View>
        ) : null}

        {/* Error Banner */}
        {bannerError ? (
          <View className="mb-3 flex-row items-center justify-between gap-2 rounded-control bg-red px-3.5 py-2.5">
            <View className="flex-1 flex-row items-center gap-2">
              <FontAwesome6 name="triangle-exclamation" size={13} color="#FFFFFF" solid />
              <Text className="flex-1 font-bold text-[12px] text-white">{bannerError}</Text>
            </View>
            <Pressable onPress={() => setBannerError(null)} hitSlop={8}>
              <FontAwesome6 name="xmark" size={13} color="#FFFFFF" solid />
            </Pressable>
          </View>
        ) : null}

        {/* Search Input */}
        <View className="mb-2.5 flex-row items-center gap-2 rounded-control border-[1.5px] border-black bg-white px-3 py-2.5">
          <FontAwesome6 name="magnifying-glass" size={14} color="#09090B" solid />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsTypingInput(true)}
            onBlur={() => setIsTypingInput(false)}
            placeholder="Cari nama barang atau ketik barcode..."
            placeholderTextColor="#09090B"
            className="flex-1 font-semibold text-[13px] text-black"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} accessibilityLabel="Hapus pencarian">
              <FontAwesome6 name="xmark" size={14} color="#09090B" solid />
            </Pressable>
          ) : null}
        </View>

        {/* Search Dropdown Results */}
        {search.trim().length > 0 ? (
          <View className="mb-3 rounded-card border-[1.5px] border-black bg-white p-2">
            {searchResults.length === 0 ? (
              <View className="p-2.5">
                <Text className="font-semibold text-[12.5px] text-black">
                  Barang &quot;{search.trim()}&quot; tidak ditemukan.
                </Text>
              </View>
            ) : (
              searchResults.map((prod) => (
                <Pressable
                  key={prod.id}
                  onPress={() => handleAddProduct(prod)}
                  className="flex-row items-center justify-between border-b border-dashed border-black px-2.5 py-2.5 last:border-b-0"
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-extrabold text-[13px] text-black" numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <Text className="font-medium text-[11.5px] text-black">
                      Stok {prod.stock} • {formatRupiah(prod.sell_price)}
                    </Text>
                  </View>
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-red">
                    <FontAwesome6 name="plus" size={11} color="#FFFFFF" solid />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {/* Main Scroll: Cart Items + Cash Checkout Card */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cart Items */}
          {items.length === 0 ? (
            <View className="mb-3 items-center rounded-card border-[1.5px] border-black bg-white px-5 py-7">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="barcode" size={20} color="#FFFFFF" solid />
              </View>
              <Text className="font-extrabold text-[15px] text-black">
                Keranjang Masih Kosong
              </Text>
              <Text className="mt-1 text-center font-medium text-[12px] text-black">
                Scan barcode lewat kamera atau scanner HID, atau cari nama barang di atas.
              </Text>
            </View>
          ) : (
            <View className="mb-3 gap-2.5">
              {items.map((item) => (
                <View
                  key={item.productId}
                  className="flex-row items-center justify-between gap-2.5 rounded-card border-[1.5px] border-black bg-white px-3.5 py-3"
                >
                  <View className="flex-1">
                    <Text className="font-extrabold text-[14px] text-black" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 font-medium text-[12px] text-black">
                      {formatRupiah(item.sellPrice)} × {item.qty} ={' '}
                      <Text className="font-extrabold text-black">
                        {formatRupiah(item.sellPrice * item.qty)}
                      </Text>
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => handleStepQty(item.productId, item.qty - 1)}
                      accessibilityLabel={`Kurangi ${item.name}`}
                      className="h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
                    >
                      <FontAwesome6 name="minus" size={11} color="#09090B" solid />
                    </Pressable>

                    <TextInput
                      value={String(item.qty)}
                      onChangeText={(t) => {
                        const clean = t.replace(/[^0-9]/g, '');
                        if (!clean) return;
                        handleStepQty(item.productId, Number.parseInt(clean, 10));
                      }}
                      onFocus={() => setIsTypingInput(true)}
                      onBlur={() => setIsTypingInput(false)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      accessibilityLabel={`Jumlah ${item.name}`}
                      className="min-w-[32px] rounded-chip border border-black bg-white px-1.5 py-0.5 text-center font-extrabold text-[13px] text-black"
                    />

                    <Pressable
                      onPress={() => handleStepQty(item.productId, item.qty + 1)}
                      accessibilityLabel={`Tambah ${item.name}`}
                      className="h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
                    >
                      <FontAwesome6 name="plus" size={11} color="#09090B" solid />
                    </Pressable>

                    <Pressable
                      onPress={() => removeItem(item.productId)}
                      accessibilityLabel={`Hapus ${item.name}`}
                      className="ml-1 h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-red bg-white"
                    >
                      <FontAwesome6 name="xmark" size={11} color="#D91E2A" solid />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Cash Payment Panel (Tunai Saja — PRD 3.4) */}
          <View className="rounded-card border-[1.5px] border-black bg-white p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-semibold text-[12.5px] text-black">
                Total ({totalQty} unit)
              </Text>
              <Text className="font-extrabold text-[18px] text-black">
                {formatRupiah(totalAmount)}
              </Text>
            </View>

            <Text className="mb-1.5 font-bold text-[12px] text-black">
              Uang Diterima (Tunai)
            </Text>
            <TextInput
              value={cashText}
              onChangeText={(t) => setCashText(t.replace(/[^0-9]/g, ''))}
              onFocus={() => setIsTypingInput(true)}
              onBlur={() => setIsTypingInput(false)}
              keyboardType="number-pad"
              placeholder="Masukkan nominal uang diterima"
              placeholderTextColor="#09090B"
              className="mb-2.5 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-extrabold text-[15px] text-black"
            />

            {/* Quick Cash Buttons */}
            <View className="mb-3 flex-row gap-2">
              {[
                { label: 'Uang Pas', value: totalAmount },
                { label: 'Rp50.000', value: 50000 },
                { label: 'Rp100.000', value: 100000 },
              ].map((opt) => {
                const selected = cashReceived === opt.value && opt.value > 0;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setCashText(opt.value > 0 ? String(opt.value) : '')}
                    className={`flex-1 items-center rounded-chip border-[1.5px] py-2 ${
                      selected ? 'border-red bg-red' : 'border-black bg-white'
                    }`}
                  >
                    <Text
                      className={`font-bold text-[11.5px] ${
                        selected ? 'text-white' : 'text-black'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Kembalian Row */}
            <View className="mb-3.5 flex-row items-center justify-between border-t-[1.5px] border-dashed border-black pt-2.5">
              <Text className="font-bold text-[13px] text-black">Kembalian</Text>
              <Text className="font-extrabold text-[16px] text-red">
                {totalAmount === 0
                  ? formatRupiah(0)
                  : changeState.isEnough
                    ? formatRupiah(changeState.change)
                    : `Kurang ${formatRupiah(changeState.shortfall)}`}
              </Text>
            </View>

            {/* Submit CTA */}
            <Pressable
              onPress={() => void handleCheckout()}
              disabled={!canPay}
              className={`flex-row items-center justify-center gap-2 rounded-control border-[1.5px] py-3.5 ${
                canPay
                  ? 'border-red bg-red'
                  : 'border-dashed border-black bg-white'
              }`}
            >
              {createSaleMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6
                  name="print"
                  size={14}
                  color={canPay ? '#FFFFFF' : '#09090B'}
                  solid
                />
              )}
              <Text
                className={`font-extrabold text-[14px] ${
                  canPay ? 'text-white' : 'text-black'
                }`}
              >
                {createSaleMutation.isPending
                  ? 'Menyimpan Transaksi...'
                  : 'Bayar & Selesaikan'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      {/* Camera Scanner Modal */}
      <CameraBarcodeModal
        visible={cameraOpen}
        title="Scan Barcode Kasir"
        closeOnScan={false}
        onScan={handleBarcodeDetected}
        onClose={() => setCameraOpen(false)}
      />

      {/* Modal: Barcode Tidak Ditemukan (PRD 3.5) */}
      <Modal
        visible={Boolean(notFoundBarcode)}
        transparent
        animationType="fade"
        onRequestClose={() => setNotFoundBarcode(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red">
              <FontAwesome6 name="triangle-exclamation" size={18} color="#FFFFFF" solid />
            </View>
            <Text className="font-extrabold text-[17px] text-black">
              Barang tidak ditemukan
            </Text>
            <Text className="mt-1.5 font-medium text-[13px] text-black">
              Barcode <Text className="font-extrabold">{notFoundBarcode}</Text> belum terdaftar di toko Anda.
            </Text>

            <View className="mt-5 gap-2.5">
              <Pressable
                onPress={() => {
                  const code = notFoundBarcode ?? '';
                  setNotFoundBarcode(null);
                  router.push({
                    pathname: '/barang/[id]',
                    params: { id: 'new', barcode: code },
                  });
                }}
                className="items-center rounded-control bg-red py-3.5"
              >
                <Text className="font-extrabold text-[13.5px] text-white">
                  Buat barang baru
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setNotFoundBarcode(null)}
                className="items-center rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <Text className="font-extrabold text-[13px] text-black">Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Transaksi Sukses (siap sambung ke Printer & PDF di Phase 6) */}
      <Modal
        visible={Boolean(lastSale)}
        transparent
        animationType="fade"
        onRequestClose={() => setLastSale(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
            <View className="mb-3 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-red">
                <FontAwesome6 name="check" size={18} color="#FFFFFF" solid />
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-[16px] text-black">
                  Transaksi Tersimpan
                </Text>
                <Text className="font-semibold text-[12px] text-black">
                  {lastSale?.sale.receipt_number}
                </Text>
              </View>
            </View>

            <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-3.5">
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-black">Waktu</Text>
                <Text className="font-bold text-[12px] text-black">
                  {lastSale ? formatDateTime(lastSale.sale.created_at) : '-'}
                </Text>
              </View>
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-black">Total</Text>
                <Text className="font-extrabold text-[13px] text-black">
                  {formatRupiah(lastSale?.sale.total_amount ?? 0)}
                </Text>
              </View>
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-black">Tunai</Text>
                <Text className="font-bold text-[12.5px] text-black">
                  {formatRupiah(lastSale?.sale.cash_received ?? 0)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t-[1.5px] border-dashed border-black pt-2">
                <Text className="font-bold text-[13px] text-black">Kembalian</Text>
                <Text className="font-extrabold text-[15px] text-red">
                  {formatRupiah(lastSale?.sale.change_amount ?? 0)}
                </Text>
              </View>
            </View>

            <View className="gap-2.5">
              <Pressable
                onPress={() => {
                  if (lastSale) {
                    void handlePrintBluetooth(lastSale);
                  }
                }}
                disabled={isPrinting}
                className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6 name="print" size={14} color="#FFFFFF" solid />
                )}
                <Text className="font-extrabold text-[13.5px] text-white">
                  {isPrinting ? 'Mencetak...' : 'Cetak Struk Bluetooth'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (lastSale) {
                    void handleSharePdf(lastSale);
                  }
                }}
                disabled={isPrinting}
                className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <FontAwesome6 name="file-pdf" size={14} color="#D91E2A" solid />
                <Text className="font-extrabold text-[13px] text-black">
                  Bagikan PDF (WhatsApp)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setPrintError(null);
                  setLastSale(null);
                }}
                className="items-center py-2"
              >
                <Text className="font-extrabold text-[13px] text-black">
                  Transaksi Baru
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dialog Gagal Cetak 3 Tombol (PRD 3.7) */}
      <PrintFailureModal
        visible={Boolean(printError && lastSale)}
        errorMessage={printError}
        isBusy={isPrinting}
        onRetry={() => {
          if (lastSale) {
            void handlePrintBluetooth(lastSale);
          }
        }}
        onChoosePrinter={() => {
          setPrintError(null);
          setPrinterPickerOpen(true);
        }}
        onSharePdf={() => {
          if (lastSale) {
            void handleSharePdf(lastSale);
          }
        }}
        onClose={() => setPrintError(null)}
      />

      {/* Picker Printer Bluetooth */}
      <PrinterPickerModal
        visible={printerPickerOpen}
        onClose={() => setPrinterPickerOpen(false)}
        onSelected={(printer) => {
          if (lastSale) {
            void handlePrintBluetooth(lastSale, printer.macAddress);
          }
        }}
      />
    </SafeAreaView>
  );
}
