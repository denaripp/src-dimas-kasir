import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';
import { ProductThumbnail } from '@/components/common/ProductThumbnail';
import {
  calculateCartItemCount,
  calculateCartTotal,
  calculateChange,
  validateCartStock,
} from '@/lib/cartCalc';
import { formatRupiah } from '@/lib/format';
import { useCartStore } from '@/store/useCartStore';

interface CheckoutSheetModalProps {
  visible: boolean;
  isOnline: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmCheckout: (cashReceived: number) => Promise<void>;
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});

export const CheckoutSheetModal = memo(function CheckoutSheetModal({
  visible,
  isOnline,
  isSubmitting,
  onClose,
  onConfirmCheckout,
}: CheckoutSheetModalProps) {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  const [cashText, setCashText] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);

  const totalAmount = useMemo(() => calculateCartTotal(items), [items]);
  const totalQty = useMemo(() => calculateCartItemCount(items), [items]);

  const parsedCash = Number.parseInt(cashText.trim(), 10);
  const cashReceived = Number.isInteger(parsedCash) && parsedCash >= 0 ? parsedCash : 0;
  const changeState = useMemo(
    () => calculateChange(totalAmount, cashReceived),
    [totalAmount, cashReceived],
  );

  const canPay =
    isOnline && items.length > 0 && changeState.isEnough && !isSubmitting;

  const handleStepQty = (productId: string, nextQty: number) => {
    setSheetError(null);
    const res = updateQty(productId, nextQty);
    if (!res.ok && res.error) {
      setSheetError(res.error);
    }
  };

  const handlePayPress = async () => {
    setSheetError(null);

    if (!isOnline) {
      setSheetError(
        'Koneksi internet terputus. Transaksi hanya bisa diproses saat online.',
      );
      return;
    }

    if (items.length === 0) {
      setSheetError('Keranjang masih kosong.');
      return;
    }

    const stockError = validateCartStock(items);
    if (stockError) {
      setSheetError(stockError);
      return;
    }

    if (!changeState.isEnough) {
      setSheetError(
        `Uang diterima masih kurang ${formatRupiah(changeState.shortfall)}.`,
      );
      return;
    }

    try {
      await onConfirmCheckout(cashReceived);
      setCashText('');
      setSheetError(null);
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : 'Transaksi gagal diproses.',
      );
    }
  };

  const quickCashOptions = useMemo(
    () => [
      { label: 'Uang Pas', value: totalAmount },
      { label: 'Rp50.000', value: 50000 },
      { label: 'Rp100.000', value: 100000 },
    ],
    [totalAmount],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <Pressable className="flex-1" onPress={onClose} />

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
              onPress={onClose}
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
                        style={styles.tabular}
                      >
                        {formatRupiah(item.sellPrice)} × {item.qty} ={' '}
                        <Text className="font-extrabold text-black">
                          {formatRupiah(item.sellPrice * item.qty)}
                        </Text>
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => handleStepQty(item.productId, item.qty - 1)}
                        accessibilityLabel={`Kurangi ${item.name}`}
                        className="h-7 w-7 items-center justify-center rounded-full bg-surface"
                      >
                        <FontAwesome6 name="minus" size={10} color="#09090B" solid />
                      </Pressable>

                      <TextInput
                        value={String(item.qty)}
                        onChangeText={(t) => {
                          const clean = t.replace(/[^0-9]/g, '');
                          if (!clean) return;
                          handleStepQty(item.productId, Number.parseInt(clean, 10));
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        accessibilityLabel={`Jumlah ${item.name}`}
                        className="min-w-[30px] rounded-chip border border-border bg-white px-1 py-0.5 text-center font-extrabold text-[12.5px] text-black"
                      />

                      <Pressable
                        onPress={() => handleStepQty(item.productId, item.qty + 1)}
                        accessibilityLabel={`Tambah ${item.name}`}
                        className="h-7 w-7 items-center justify-center rounded-full bg-surface"
                      >
                        <FontAwesome6 name="plus" size={10} color="#09090B" solid />
                      </Pressable>

                      <Pressable
                        onPress={() => removeItem(item.productId)}
                        accessibilityLabel={`Hapus ${item.name}`}
                        className="ml-0.5 h-7 w-7 items-center justify-center rounded-full bg-red-soft"
                      >
                        <FontAwesome6 name="xmark" size={10} color="#D91E2A" solid />
                      </Pressable>
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
                  style={styles.tabular}
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
                keyboardType="number-pad"
                placeholder="Masukkan nominal uang diterima"
                placeholderTextColor="#71717A"
                className="mb-2.5 rounded-control border border-border bg-white px-3.5 py-2.5 font-extrabold text-[16px] text-black"
              />

              {/* Quick Cash Chips */}
              <View className="mb-3 flex-row gap-2">
                {quickCashOptions.map((opt) => {
                  const selected = cashReceived === opt.value && opt.value > 0;
                  return (
                    <MotionPressable
                      key={opt.label}
                      wrapperClassName="flex-1"
                      onPress={() => setCashText(opt.value > 0 ? String(opt.value) : '')}
                      className={`items-center rounded-chip border py-2 ${
                        selected ? 'border-black bg-black' : 'border-border bg-white'
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
                  style={styles.tabular}
                >
                  {totalAmount === 0
                    ? formatRupiah(0)
                    : changeState.isEnough
                      ? formatRupiah(changeState.change)
                      : `Kurang ${formatRupiah(changeState.shortfall)}`}
                </Text>
              </View>
            </View>

            {sheetError ? (
              <View className="mb-3 rounded-control bg-red-soft px-3.5 py-2.5">
                <Text className="font-bold text-[12px] text-red">{sheetError}</Text>
              </View>
            ) : null}

            <MotionPressable
              onPress={() => void handlePayPress()}
              disabled={!canPay}
              className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-control py-3.5 ${
                canPay ? 'bg-red' : 'bg-surface'
              }`}
            >
              {isSubmitting ? (
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
                {isSubmitting ? 'Menyimpan Transaksi...' : 'Bayar & Selesaikan'}
              </Text>
            </MotionPressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
