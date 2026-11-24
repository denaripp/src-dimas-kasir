import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
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
import { EASE_SMOOTH, MOTION_DURATION } from '@/lib/motion';
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
  const { data: products = [], isLoading: isLoadingProducts } = useProductsQuery(store?.id);
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cashText, setCashText] = useState('');
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
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

  useEffect(() => {
    if (items.length === 0 && checkoutSheetOpen) {
      setCheckoutSheetOpen(false);
    }
  }, [items.length, checkoutSheetOpen]);

  const totalAmount = useMemo(() => calculateCartTotal(items), [items]);
  const totalQty = useMemo(() => calculateCartItemCount(items), [items]);

  const qtyByProductId = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => map.set(it.productId, it.qty));
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const cat = p.category.trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category.trim() !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory]);

  const parsedCash = Number.parseInt(cashText.trim(), 10);
  const cashReceived = Number.isInteger(parsedCash) && parsedCash >= 0 ? parsedCash : 0;
  const changeState = useMemo(
    () => calculateChange(totalAmount, cashReceived),
    [totalAmount, cashReceived],
  );

  const handleAddProduct = useCallback(
    (product: ProductRow) => {
      setBannerError(null);
      const res = addItem(product);
      if (!res.ok) {
        setBannerError(res.error ?? 'Stok barang tidak cukup.');
        Vibration.vibrate(80);
        return;
      }
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
      setSearch('');
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
      setCheckoutSheetOpen(false);
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
    !checkoutSheetOpen &&
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

  const renderCatalogItem = ({ item }: { item: ProductRow }) => {
    const qty = qtyByProductId.get(item.id) ?? 0;
    const isLow = item.stock <= item.min_stock;
    const isOut = item.stock <= 0;

    return (
      <View className="w-1/2 p-1.5">
        <MotionPressable
          onPress={() => handleAddProduct(item)}
          scaleTo={0.97}
          className={`rounded-2xl border bg-white p-2 ${
            qty > 0 ? 'border-[1.5px] border-red' : 'border-border'
          }`}
        >
          <View className="relative mb-2">
            <ProductThumbnail
              imageUrl={item.image_url}
              fillWidth
              aspectRatio={4 / 3}
              iconSize={22}
            />

            {qty > 0 ? (
              <View className="absolute right-1.5 top-1.5 min-w-[24px] items-center justify-center rounded-full bg-red px-1.5 py-0.5">
                <Text
                  className="font-extrabold text-[11px] text-white"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {qty}
                </Text>
              </View>
            ) : null}

            <View
              className={`absolute bottom-1.5 left-1.5 rounded-[6px] px-1.5 py-0.5 ${
                isLow || isOut ? 'bg-red-soft' : 'bg-white/95'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  isLow || isOut ? 'text-red' : 'text-black'
                }`}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {isOut ? 'Habis' : `Stok ${item.stock}`}
              </Text>
            </View>
          </View>

          <Text
            className="min-h-[34px] font-bold text-[12.5px] leading-[17px] text-black"
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <View className="mt-1.5 flex-row items-center justify-between gap-1">
            <Text
              className="font-extrabold text-[13px] text-black"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
            >
              {formatRupiah(item.sell_price)}
            </Text>

            {qty > 0 ? (
              <MotionPressable
                onPress={() => handleStepQty(item.id, qty - 1)}
                accessibilityLabel={`Kurangi ${item.name}`}
                className="h-6 w-6 items-center justify-center rounded-[7px] border border-border bg-white"
              >
                <FontAwesome6 name="minus" size={10} color="#09090B" solid />
              </MotionPressable>
            ) : (
              <Text className="font-bold text-[11px] text-muted">+ Tap</Text>
            )}
          </View>
        </MotionPressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <HidScannerInput enabled={hidEnabled} onScan={handleBarcodeDetected} />

      <View className="relative flex-1 px-[18px] pt-3">
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="font-extrabold text-[20px] tracking-[-0.03em] text-black">
              Kasir Tunai
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2.5">
              <View className="flex-row items-center gap-1.5">
                <View
                  className={`h-2 w-2 rounded-full ${isOnline ? 'bg-red' : 'bg-muted'}`}
                />
                <Text
                  className={`font-semibold text-[11.5px] ${
                    isOnline ? 'text-muted' : 'text-red'
                  }`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
              <Text className="text-[11.5px] text-muted">•</Text>
              <View className="flex-row items-center gap-1">
                <FontAwesome6 name="barcode" size={10} color="#71717A" solid />
                <Text className="font-semibold text-[11.5px] text-muted">
                  HID {hidEnabled ? 'Siap' : 'Jeda'}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {items.length > 0 ? (
              <MotionPressable
                onPress={() => {
                  clearCart();
                  setCashText('');
                  setBannerError(null);
                }}
                accessibilityLabel="Kosongkan keranjang"
                className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              >
                <FontAwesome6 name="trash" size={14} color="#09090B" solid />
              </MotionPressable>
            ) : null}

            <MotionPressable
              onPress={() => setCameraOpen(true)}
              accessibilityLabel="Pindai barcode dengan kamera"
              className="h-10 w-10 items-center justify-center rounded-full bg-red"
            >
              <FontAwesome6 name="camera" size={15} color="#FFFFFF" solid />
            </MotionPressable>
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
          <View className="mb-3 flex-row items-center justify-between gap-2 rounded-control bg-red-soft px-3.5 py-2.5">
            <View className="flex-1 flex-row items-center gap-2">
              <FontAwesome6 name="triangle-exclamation" size={13} color="#D91E2A" solid />
              <Text className="flex-1 font-bold text-[12px] text-red">{bannerError}</Text>
            </View>
            <Pressable onPress={() => setBannerError(null)} hitSlop={8}>
              <FontAwesome6 name="xmark" size={13} color="#D91E2A" solid />
            </Pressable>
          </View>
        ) : null}

        {/* Soft Search Input */}
        <View className="mb-3 flex-row items-center gap-2.5 rounded-control bg-surface px-3.5 py-2.5">
          <FontAwesome6 name="magnifying-glass" size={13} color="#71717A" solid />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsTypingInput(true)}
            onBlur={() => setIsTypingInput(false)}
            placeholder="Cari nama barang atau scan barcode..."
            placeholderTextColor="#71717A"
            className="flex-1 font-semibold text-[13px] text-black"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} accessibilityLabel="Hapus pencarian" hitSlop={8}>
              <FontAwesome6 name="xmark" size={14} color="#71717A" solid />
            </Pressable>
          ) : null}
        </View>

        {/* Category Filter Strip */}
        <View className="mb-2.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <MotionPressable
              onPress={() => setSelectedCategory('all')}
              className={`rounded-chip border px-3 py-1.5 ${
                selectedCategory === 'all' ? 'border-black bg-black' : 'border-border bg-white'
              }`}
            >
              <Text
                className={`text-[12px] ${
                  selectedCategory === 'all'
                    ? 'font-bold text-white'
                    : 'font-semibold text-black'
                }`}
              >
                Semua
              </Text>
            </MotionPressable>

            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <MotionPressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`rounded-chip border px-3 py-1.5 ${
                    active ? 'border-black bg-black' : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
                      active ? 'font-bold text-white' : 'font-semibold text-black'
                    }`}
                  >
                    {cat}
                  </Text>
                </MotionPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2-Column Visual Product Catalog */}
        {isLoadingProducts ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#D91E2A" />
          </View>
        ) : (
          <FlatList
            data={filteredCatalog}
            keyExtractor={(item) => item.id}
            numColumns={2}
            renderItem={renderCatalogItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: items.length > 0 ? 96 : 24,
              marginHorizontal: -6,
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <View className="mx-1.5 mt-6 items-center rounded-card border border-border bg-white p-6">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
                  <FontAwesome6 name="barcode" size={18} color="#D91E2A" solid />
                </View>
                <Text className="font-extrabold text-[15px] text-black">
                  {products.length === 0 ? 'Belum Ada Barang' : 'Barang Tidak Ditemukan'}
                </Text>
                <Text className="mt-1 text-center font-medium text-[12px] leading-4 text-muted">
                  {products.length === 0
                    ? 'Tambahkan barang terlebih dahulu di menu Barang agar bisa dipilih di Kasir.'
                    : 'Coba kata kunci lain atau scan langsung dengan kamera barcode.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Sticky Floating Cart Summary Bar */}
        {items.length > 0 ? (
          <Animated.View
            entering={FadeInDown.duration(MOTION_DURATION.sheet).easing(EASE_SMOOTH)}
            exiting={FadeOutDown.duration(200)}
            className="absolute bottom-3 left-[18px] right-[18px] flex-row items-center justify-between rounded-2xl bg-black py-2.5 pl-4 pr-2.5"
            style={{
              shadowColor: '#09090B',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.22,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Pressable
              onPress={() => setCheckoutSheetOpen(true)}
              className="flex-1 pr-2"
            >
              <Text
                className="font-semibold text-[11px] text-white/75"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {totalQty} unit di keranjang
              </Text>
              <Text
                className="mt-0.5 font-extrabold text-[16.5px] text-white"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatRupiah(totalAmount)}
              </Text>
            </Pressable>

            <MotionPressable
              onPress={() => setCheckoutSheetOpen(true)}
              className="flex-row items-center gap-2 rounded-[11px] bg-red px-4 py-2.5"
            >
              <Text className="font-extrabold text-[13px] text-white">Bayar</Text>
              <FontAwesome6 name="chevron-right" size={11} color="#FFFFFF" solid />
            </MotionPressable>
          </Animated.View>
        ) : null}
      </View>

      {/* Slide-Up Checkout Sheet */}
      <Modal
        visible={checkoutSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <Pressable
            className="flex-1"
            onPress={() => setCheckoutSheetOpen(false)}
          />

          <View className="max-h-[86%] rounded-t-[26px] bg-white px-[18px] pb-6 pt-3">
            {/* Handle */}
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-border" />

            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="font-extrabold text-[16.5px] text-black">
                  Ringkasan Pembayaran
                </Text>
                <Text className="mt-0.5 font-medium text-[12px] text-muted">
                  {totalQty} unit • Pembayaran Tunai
                </Text>
              </View>
              <MotionPressable
                onPress={() => setCheckoutSheetOpen(false)}
                accessibilityLabel="Tutup ringkasan pembayaran"
                className="h-9 w-9 items-center justify-center rounded-full bg-surface"
              >
                <FontAwesome6 name="xmark" size={14} color="#09090B" solid />
              </MotionPressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Cart Items List */}
              <View className="mb-3.5 overflow-hidden rounded-card border border-border bg-white">
                {items.map((item, idx) => {
                  const isLast = idx === items.length - 1;
                  return (
                    <View
                      key={item.productId}
                      className={`flex-row items-center gap-2.5 px-3 py-2.5 ${
                        !isLast ? 'border-b border-border' : ''
                      }`}
                    >
                      <ProductThumbnail imageUrl={item.imageUrl} size={40} iconSize={14} />

                      <View className="flex-1">
                        <Text className="font-bold text-[13px] text-black" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text
                          className="mt-0.5 font-medium text-[11.5px] text-muted"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {formatRupiah(item.sellPrice)} × {item.qty} ={' '}
                          <Text className="font-extrabold text-black">
                            {formatRupiah(item.sellPrice * item.qty)}
                          </Text>
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1.5">
                        <MotionPressable
                          onPress={() => handleStepQty(item.productId, item.qty - 1)}
                          accessibilityLabel={`Kurangi ${item.name}`}
                          className="h-7 w-7 items-center justify-center rounded-full bg-surface"
                        >
                          <FontAwesome6 name="minus" size={10} color="#09090B" solid />
                        </MotionPressable>

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
                          className="min-w-[30px] rounded-chip border border-border bg-white px-1 py-0.5 text-center font-extrabold text-[12.5px] text-black"
                        />

                        <MotionPressable
                          onPress={() => handleStepQty(item.productId, item.qty + 1)}
                          accessibilityLabel={`Tambah ${item.name}`}
                          className="h-7 w-7 items-center justify-center rounded-full bg-surface"
                        >
                          <FontAwesome6 name="plus" size={10} color="#09090B" solid />
                        </MotionPressable>

                        <MotionPressable
                          onPress={() => removeItem(item.productId)}
                          accessibilityLabel={`Hapus ${item.name}`}
                          className="ml-0.5 h-7 w-7 items-center justify-center rounded-full bg-red-soft"
                        >
                          <FontAwesome6 name="xmark" size={10} color="#D91E2A" solid />
                        </MotionPressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Cash Payment Summary Tile */}
              <View className="mb-4 rounded-card bg-surface p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-bold text-[13px] text-black">Total Tagihan</Text>
                  <Text
                    className="font-extrabold text-[19px] text-black"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
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
                  placeholderTextColor="#71717A"
                  className="mb-2.5 rounded-control border border-border bg-white px-3.5 py-2.5 font-extrabold text-[16px] text-black"
                />

                {/* Quick Cash Chips */}
                <View className="mb-3 flex-row gap-2">
                  {[
                    { label: 'Uang Pas', value: totalAmount },
                    { label: 'Rp50.000', value: 50000 },
                    { label: 'Rp100.000', value: 100000 },
                  ].map((opt) => {
                    const selected = cashReceived === opt.value && opt.value > 0;
                    return (
                      <MotionPressable
                        key={opt.label}
                        wrapperClassName="flex-1"
                        onPress={() => setCashText(opt.value > 0 ? String(opt.value) : '')}
                        className={`items-center rounded-chip border py-2 ${
                          selected
                            ? 'border-black bg-black'
                            : 'border-border bg-white'
                        }`}
                      >
                        <Text
                          className={`font-bold text-[11.5px] ${
                            selected ? 'text-white' : 'text-black'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </MotionPressable>
                    );
                  })}
                </View>

                <View className="flex-row items-center justify-between border-t border-dashed border-border pt-2.5">
                  <Text className="font-bold text-[13px] text-black">Kembalian</Text>
                  <Text
                    className="font-extrabold text-[16.5px] text-red"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {totalAmount === 0
                      ? formatRupiah(0)
                      : changeState.isEnough
                        ? formatRupiah(changeState.change)
                        : `Kurang ${formatRupiah(changeState.shortfall)}`}
                  </Text>
                </View>
              </View>

              {bannerError ? (
                <View className="mb-3 rounded-control bg-red-soft px-3.5 py-2.5">
                  <Text className="font-bold text-[12px] text-red">{bannerError}</Text>
                </View>
              ) : null}

              <MotionPressable
                onPress={() => void handleCheckout()}
                disabled={!canPay}
                className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-control py-3.5 ${
                  canPay ? 'bg-red' : 'bg-surface'
                }`}
              >
                {createSaleMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6
                    name="print"
                    size={14}
                    color={canPay ? '#FFFFFF' : '#71717A'}
                    solid
                  />
                )}
                <Text
                  className={`font-extrabold text-[14px] ${
                    canPay ? 'text-white' : 'text-muted'
                  }`}
                >
                  {createSaleMutation.isPending
                    ? 'Menyimpan Transaksi...'
                    : 'Bayar & Selesaikan'}
                </Text>
              </MotionPressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full rounded-hero border border-border bg-white p-5">
            <View className="mb-3.5 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
              <FontAwesome6 name="triangle-exclamation" size={18} color="#D91E2A" solid />
            </View>
            <Text className="font-extrabold text-[17px] text-black">
              Barang tidak ditemukan
            </Text>
            <Text className="mt-1.5 font-medium text-[13px] leading-5 text-muted">
              Barcode <Text className="font-extrabold text-black">{notFoundBarcode}</Text> belum terdaftar di toko Anda.
            </Text>

            <View className="mt-5 gap-2.5">
              <MotionPressable
                onPress={() => {
                  const code = notFoundBarcode ?? '';
                  setNotFoundBarcode(null);
                  router.push({
                    pathname: '/barang/[id]',
                    params: { id: 'new', barcode: code },
                  });
                }}
                className="min-h-[46px] items-center justify-center rounded-control bg-red py-3"
              >
                <Text className="font-extrabold text-[13.5px] text-white">
                  Buat barang baru
                </Text>
              </MotionPressable>

              <MotionPressable
                onPress={() => setNotFoundBarcode(null)}
                className="min-h-[44px] items-center justify-center rounded-control border border-border bg-white py-3"
              >
                <Text className="font-bold text-[13px] text-black">Tutup</Text>
              </MotionPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Transaksi Sukses + Cetak Struk / PDF */}
      <Modal
        visible={Boolean(lastSale)}
        transparent
        animationType="fade"
        onRequestClose={() => setLastSale(null)}
      >
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
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {lastSale?.sale.receipt_number}
                </Text>
              </View>
            </View>

            <View className="mb-4 rounded-card bg-surface p-3.5">
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-muted">Waktu</Text>
                <Text className="font-bold text-[12px] text-black">
                  {lastSale ? formatDateTime(lastSale.sale.created_at) : '-'}
                </Text>
              </View>
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-muted">Total</Text>
                <Text
                  className="font-extrabold text-[13px] text-black"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatRupiah(lastSale?.sale.total_amount ?? 0)}
                </Text>
              </View>
              <View className="mb-1.5 flex-row justify-between">
                <Text className="font-medium text-[12px] text-muted">Tunai</Text>
                <Text
                  className="font-bold text-[12.5px] text-black"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatRupiah(lastSale?.sale.cash_received ?? 0)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-dashed border-border pt-2">
                <Text className="font-bold text-[13px] text-black">Kembalian</Text>
                <Text
                  className="font-extrabold text-[15px] text-red"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatRupiah(lastSale?.sale.change_amount ?? 0)}
                </Text>
              </View>
            </View>

            <View className="gap-2.5">
              <MotionPressable
                onPress={() => {
                  if (lastSale) {
                    void handlePrintBluetooth(lastSale);
                  }
                }}
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
                onPress={() => {
                  if (lastSale) {
                    void handleSharePdf(lastSale);
                  }
                }}
                disabled={isPrinting}
                className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
              >
                <FontAwesome6 name="file-pdf" size={14} color="#D91E2A" solid />
                <Text className="font-bold text-[13px] text-black">
                  Bagikan PDF (WhatsApp)
                </Text>
              </MotionPressable>

              <MotionPressable
                onPress={() => {
                  setPrintError(null);
                  setLastSale(null);
                }}
                className="items-center py-2.5"
              >
                <Text className="font-bold text-[13px] text-muted">Transaksi Baru</Text>
              </MotionPressable>
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
