import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { CatalogProductCard } from '@/components/kasir/CatalogProductCard';
import { CheckoutSheetModal } from '@/components/kasir/CheckoutSheetModal';
import { SaleSuccessModal } from '@/components/kasir/SaleSuccessModal';
import { PrintFailureModal } from '@/components/printer/PrintFailureModal';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { CameraBarcodeModal } from '@/components/scanner/CameraBarcodeModal';
import { HidScannerInput } from '@/components/scanner/HidScannerInput';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProductsQuery } from '@/hooks/useProducts';
import { useReceiptPrinter } from '@/hooks/useReceiptPrinter';
import { useCreateSaleMutation } from '@/hooks/useSales';
import { matchBarcode, normalizeBarcode } from '@/lib/barcode';
import { calculateCartItemCount, calculateCartTotal } from '@/lib/cartCalc';
import { formatRupiah } from '@/lib/format';
import { EASE_SMOOTH, MOTION_DURATION } from '@/lib/motion';
import { extractProductCategories, filterProducts } from '@/lib/productFilters';
import { useCartStore } from '@/store/useCartStore';
import type { CreateSaleAtomicResult, ProductRow } from '@/types/database';

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  categoryStrip: {
    gap: 6,
  },
  listContentEmpty: {
    paddingBottom: 24,
    marginHorizontal: -6,
    flexGrow: 1,
  },
  listContentWithCart: {
    paddingBottom: 96,
    marginHorizontal: -6,
    flexGrow: 1,
  },
  floatingBarShadow: {
    shadowColor: '#09090B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
});

const FloatingCartBar = memo(function FloatingCartBar({
  onOpenCheckout,
}: {
  onOpenCheckout: () => void;
}) {
  const items = useCartStore((s) => s.items);
  const totalAmount = useMemo(() => calculateCartTotal(items), [items]);
  const totalQty = useMemo(() => calculateCartItemCount(items), [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(MOTION_DURATION.sheet).easing(EASE_SMOOTH)}
      exiting={FadeOutDown.duration(200)}
      className="absolute bottom-3 left-[18px] right-[18px] flex-row items-center justify-between rounded-2xl bg-black py-2.5 pl-4 pr-2.5"
      style={styles.floatingBarShadow}
    >
      <Pressable onPress={onOpenCheckout} className="flex-1 pr-2">
        <Text
          className="font-semibold text-[11px] text-white/75"
          style={styles.tabular}
        >
          {totalQty} unit di keranjang
        </Text>
        <Text
          className="mt-0.5 font-extrabold text-[16.5px] text-white"
          style={styles.tabular}
        >
          {formatRupiah(totalAmount)}
        </Text>
      </Pressable>

      <MotionPressable
        onPress={onOpenCheckout}
        className="flex-row items-center gap-2 rounded-[11px] bg-red px-4 py-2.5"
      >
        <Text className="font-extrabold text-[13px] text-white">Bayar</Text>
        <FontAwesome6 name="chevron-right" size={11} color="#FFFFFF" solid />
      </MotionPressable>
    </Animated.View>
  );
});

const keyExtractor = (item: ProductRow) => item.id;

export default function KasirScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { store } = useAuth();
  const { isOnline } = useNetworkStatus();
  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isSuccess: isProductsLoaded,
    refetch,
  } = useProductsQuery(store?.id);
  const createSaleMutation = useCreateSaleMutation();
  const printer = useReceiptPrinter({ successTitle: 'Struk Dicetak' });

  // Subscribe hanya ke boolean hasCartItems & actions (tap produk tidak re-render grid)
  const hasCartItems = useCartStore((s) => s.items.length > 0);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const syncProductStocks = useCartStore((s) => s.syncProductStocks);
  const clearCart = useCartStore((s) => s.clearCart);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
  const [isTypingInput, setIsTypingInput] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [zeroStockProduct, setZeroStockProduct] = useState<ProductRow | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<CreateSaleAtomicResult | null>(null);

  useEffect(() => {
    if (isFocused) {
      void refetch();
    }
  }, [isFocused, refetch]);

  useEffect(() => {
    if (isProductsLoaded) {
      syncProductStocks(products);
    }
  }, [isProductsLoaded, products, syncProductStocks]);

  useEffect(() => {
    if (!hasCartItems && checkoutSheetOpen) {
      setCheckoutSheetOpen(false);
    }
  }, [hasCartItems, checkoutSheetOpen]);

  const categories = useMemo(() => extractProductCategories(products), [products]);

  const filteredCatalog = useMemo(
    () =>
      filterProducts(products, {
        search: deferredSearch,
        category: selectedCategory,
      }),
    [products, deferredSearch, selectedCategory],
  );

  const handleAddProduct = useCallback(
    (product: ProductRow) => {
      setBannerError(null);
      const res = addItem(product);
      if (!res.ok) {
        setBannerError(res.error ?? 'Stok barang tidak cukup.');
        Vibration.vibrate(80);
      }
    },
    [addItem],
  );

  const handleStepQty = useCallback(
    (productId: string, nextQty: number) => {
      setBannerError(null);
      const res = updateQty(productId, nextQty);
      if (!res.ok && res.error) {
        setBannerError(res.error);
      }
    },
    [updateQty],
  );

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const cleaned = normalizeBarcode(barcode);
      if (!cleaned) return;

      const found = products.find((p) => matchBarcode(p.barcode, cleaned));

      if (!found) {
        Vibration.vibrate([0, 60, 60, 60]);
        setCameraOpen(false);
        setNotFoundBarcode(cleaned);
        return;
      }

      if (found.stock <= 0) {
        Vibration.vibrate(80);
        setCameraOpen(false);
        setZeroStockProduct(found);
        return;
      }

      handleAddProduct(found);
      setSearch('');
    },
    [products, handleAddProduct],
  );

  const handleConfirmCheckout = useCallback(
    async (cashReceived: number) => {
      const currentItems = useCartStore.getState().items;
      const result = await createSaleMutation.mutateAsync({
        cashReceived,
        items: currentItems.map((i) => ({ product_id: i.productId, qty: i.qty })),
      });
      setCheckoutSheetOpen(false);
      clearCart();
      setBannerError(null);
      setLastSale(result);
    },
    [createSaleMutation, clearCart],
  );

  const openCheckoutSheet = useCallback(() => setCheckoutSheetOpen(true), []);
  const closeCheckoutSheet = useCallback(() => setCheckoutSheetOpen(false), []);

  const renderCatalogItem = useCallback(
    ({ item }: { item: ProductRow }) => (
      <CatalogProductCard
        product={item}
        onAdd={handleAddProduct}
        onStepQty={handleStepQty}
      />
    ),
    [handleAddProduct, handleStepQty],
  );

  const emptyComponent = useMemo(
    () => (
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
    ),
    [products.length],
  );

  const hidEnabled =
    isFocused &&
    !isTypingInput &&
    !checkoutSheetOpen &&
    !cameraOpen &&
    !notFoundBarcode &&
    !zeroStockProduct &&
    !lastSale &&
    !printer.printerPickerOpen &&
    !printer.printError;

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
            {hasCartItems ? (
              <MotionPressable
                onPress={() => {
                  clearCart();
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

        {/* Offline Warning Banner */}
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
            <Pressable
              onPress={() => setSearch('')}
              accessibilityLabel="Hapus pencarian"
              hitSlop={8}
            >
              <FontAwesome6 name="xmark" size={14} color="#71717A" solid />
            </Pressable>
          ) : null}
        </View>

        {/* Category Filter Strip */}
        <View className="mb-2.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryStrip}
          >
            <Pressable
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
            </Pressable>

            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
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
                </Pressable>
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
            keyExtractor={keyExtractor}
            numColumns={2}
            renderItem={renderCatalogItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={5}
            contentContainerStyle={
              hasCartItems ? styles.listContentWithCart : styles.listContentEmpty
            }
            ListEmptyComponent={emptyComponent}
          />
        )}

        {/* Sticky Floating Cart Summary Bar */}
        <FloatingCartBar onOpenCheckout={openCheckoutSheet} />
      </View>

      {/* Lazy-mounted Modals (0 overhead saat tertutup) */}
      {checkoutSheetOpen ? (
        <CheckoutSheetModal
          visible={checkoutSheetOpen}
          isOnline={isOnline}
          isSubmitting={createSaleMutation.isPending}
          onClose={closeCheckoutSheet}
          onConfirmCheckout={handleConfirmCheckout}
        />
      ) : null}

      {cameraOpen ? (
        <CameraBarcodeModal
          visible={cameraOpen}
          title="Scan Barcode Kasir"
          closeOnScan={false}
          onScan={handleBarcodeDetected}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}

      {zeroStockProduct ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setZeroStockProduct(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 px-6">
            <View className="w-full rounded-hero border border-border bg-white p-5">
              <View className="mb-3.5 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
                <FontAwesome6 name="boxes-stacked" size={18} color="#D91E2A" solid />
              </View>
              <Text className="font-extrabold text-[17px] text-black">
                Stok Barang Habis
              </Text>
              <Text className="mt-1.5 font-medium text-[13px] leading-5 text-muted">
                Barang <Text className="font-extrabold text-black">{zeroStockProduct.name}</Text> ditemukan, tetapi stoknya saat ini <Text className="font-extrabold text-red">0</Text>. Tambah stok terlebih dahulu agar dapat dijual di kasir.
              </Text>

              <View className="mt-5 gap-2.5">
                <MotionPressable
                  onPress={() => {
                    const id = zeroStockProduct.id;
                    setZeroStockProduct(null);
                    router.push(`/stok/${id}`);
                  }}
                  className="min-h-[46px] items-center justify-center rounded-control bg-red py-3"
                >
                  <Text className="font-extrabold text-[13.5px] text-white">
                    Tambah Stok Sekarang
                  </Text>
                </MotionPressable>

                <MotionPressable
                  onPress={() => setZeroStockProduct(null)}
                  className="min-h-[44px] items-center justify-center rounded-control border border-border bg-white py-3"
                >
                  <Text className="font-bold text-[13px] text-black">Tutup</Text>
                </MotionPressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {notFoundBarcode ? (
        <Modal
          visible
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
                    const code = notFoundBarcode;
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
      ) : null}

      {lastSale ? (
        <SaleSuccessModal
          saleResult={lastSale}
          isPrinting={printer.isPrinting}
          onPrintBluetooth={() => void printer.printBluetooth(lastSale)}
          onSharePdf={() => void printer.sharePdf(lastSale)}
          onClose={() => {
            printer.clearPrintError();
            setLastSale(null);
          }}
        />
      ) : null}

      {printer.printError && lastSale ? (
        <PrintFailureModal
          visible
          errorMessage={printer.printError}
          isBusy={printer.isPrinting}
          onRetry={() => void printer.printBluetooth(lastSale)}
          onChoosePrinter={printer.openPrinterPicker}
          onSharePdf={() => void printer.sharePdf(lastSale)}
          onClose={printer.clearPrintError}
        />
      ) : null}

      {printer.printerPickerOpen ? (
        <PrinterPickerModal
          visible
          onClose={printer.closePrinterPicker}
          onSelected={(selected) => {
            if (lastSale) {
              void printer.printBluetooth(lastSale, selected.macAddress);
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
