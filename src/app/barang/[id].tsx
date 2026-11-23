import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraBarcodeModal } from '@/components/scanner/CameraBarcodeModal';
import { useAuth } from '@/hooks/useAuth';
import {
  useDeleteProductMutation,
  useProductByIdQuery,
  useSaveProductMutation,
} from '@/hooks/useProducts';
import {
  parseIntOrZero,
  productFormSchema,
  type ProductFormValues,
} from '@/lib/productSchema';

export default function ProductFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; barcode?: string }>();
  const productId = params.id;
  const isNew = !productId || productId === 'new';

  const { store } = useAuth();
  const { data: existingProduct, isLoading } = useProductByIdQuery(
    isNew ? undefined : productId,
  );
  const saveMutation = useSaveProductMutation();
  const deleteMutation = useDeleteProductMutation();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      barcode: typeof params.barcode === 'string' ? params.barcode : '',
      category: '',
      sell_price: '',
      cost_price: '0',
      stock: '0',
      min_stock: '0',
    },
  });

  useEffect(() => {
    if (existingProduct) {
      reset({
        name: existingProduct.name,
        barcode: existingProduct.barcode ?? '',
        category: existingProduct.category ?? '',
        sell_price: String(existingProduct.sell_price),
        cost_price: String(existingProduct.cost_price),
        stock: String(existingProduct.stock),
        min_stock: String(existingProduct.min_stock),
      });
    }
  }, [existingProduct, reset]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!store?.id) {
      setSubmitError('Data toko belum tersedia.');
      return;
    }

    setSubmitError(null);
    try {
      await saveMutation.mutateAsync({
        id: isNew ? undefined : productId,
        store_id: store.id,
        name: values.name,
        barcode: values.barcode ? values.barcode : null,
        category: values.category,
        sell_price: parseIntOrZero(values.sell_price),
        cost_price: parseIntOrZero(values.cost_price),
        stock: parseIntOrZero(values.stock),
        min_stock: parseIntOrZero(values.min_stock),
      });
      router.back();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan barang.');
    }
  };

  const confirmDelete = () => {
    if (isNew || !productId) return;

    Alert.alert(
      'Hapus Barang?',
      'Jika barang pernah terjual, barang akan dinonaktifkan agar riwayat tetap utuh. Jika belum pernah terjual, barang akan dihapus permanen.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const res = await deleteMutation.mutateAsync(productId);
                Alert.alert(
                  'Berhasil',
                  res.mode === 'soft_deleted'
                    ? 'Barang dinonaktifkan karena sudah memiliki riwayat penjualan.'
                    : 'Barang berhasil dihapus permanen.',
                );
                router.back();
              } catch (err) {
                setSubmitError(
                  err instanceof Error ? err.message : 'Gagal menghapus barang.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  if (!isNew && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#D91E2A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-[18px] py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Kembali"
            className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
          >
            <FontAwesome6 name="chevron-left" size={15} color="#09090B" solid />
          </Pressable>
          <Text className="font-extrabold text-[16px] text-black">
            {isNew ? 'Tambah Barang' : 'Edit Barang'}
          </Text>
          {!isNew && productId ? (
            <Pressable
              onPress={() => router.push(`/stok/${productId}`)}
              accessibilityLabel="Kelola stok barang"
              className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
            >
              <FontAwesome6 name="boxes-stacked" size={14} color="#09090B" solid />
            </Pressable>
          ) : (
            <View className="h-10 w-10" />
          )}
        </View>

        <ScrollView
          className="flex-1 px-[18px]"
          contentContainerStyle={{ paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {submitError ? (
            <View className="mb-3.5 flex-row items-center gap-2 rounded-control bg-red px-4 py-3">
              <FontAwesome6 name="triangle-exclamation" size={14} color="#FFFFFF" solid />
              <Text className="flex-1 font-semibold text-[12px] text-white">{submitError}</Text>
            </View>
          ) : null}

          {/* Nama Barang */}
          <View className="mb-3.5">
            <Text className="mb-1.5 font-bold text-[12.5px] text-black">Nama Barang *</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Contoh: Indomie Goreng Original"
                  placeholderTextColor="#09090B"
                  className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-semibold text-[13.5px] text-black"
                />
              )}
            />
            {errors.name ? (
              <Text className="mt-1 font-bold text-[11.5px] text-red">
                {errors.name.message}
              </Text>
            ) : null}
          </View>

          {/* Barcode (Kamera / HID / Manual) */}
          <View className="mb-3.5">
            <Text className="mb-1.5 font-bold text-[12.5px] text-black">
              Barcode (Opsional — Scan Kamera, HID, atau Ketik)
            </Text>
            <View className="flex-row items-center gap-2">
              <Controller
                control={control}
                name="barcode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Kosongkan jika tanpa barcode"
                    placeholderTextColor="#09090B"
                    className="flex-1 rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-semibold text-[13.5px] text-black"
                  />
                )}
              />
              <Pressable
                onPress={() => setScannerOpen(true)}
                accessibilityLabel="Pindai barcode dengan kamera"
                className="h-[48px] w-[48px] items-center justify-center rounded-control border-[1.5px] border-red bg-red"
              >
                <FontAwesome6 name="camera" size={17} color="#FFFFFF" solid />
              </Pressable>
            </View>
          </View>

          {/* Kategori */}
          <View className="mb-3.5">
            <Text className="mb-1.5 font-bold text-[12.5px] text-black">
              Kategori (Opsional)
            </Text>
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Contoh: Makanan, Minuman, Sembako"
                  placeholderTextColor="#09090B"
                  className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-semibold text-[13.5px] text-black"
                />
              )}
            />
          </View>

          {/* Harga Jual & Harga Modal */}
          <View className="mb-3.5 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12.5px] text-black">
                Harga Jual (Rp) *
              </Text>
              <Controller
                control={control}
                name="sell_price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                    onBlur={onBlur}
                    keyboardType="number-pad"
                    placeholder="3500"
                    placeholderTextColor="#09090B"
                    className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-extrabold text-[14px] text-black"
                  />
                )}
              />
              {errors.sell_price ? (
                <Text className="mt-1 font-bold text-[11px] text-red">
                  {errors.sell_price.message}
                </Text>
              ) : null}
            </View>

            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12.5px] text-black">
                Harga Modal (Rp)
              </Text>
              <Controller
                control={control}
                name="cost_price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                    onBlur={onBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#09090B"
                    className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-extrabold text-[14px] text-black"
                  />
                )}
              />
            </View>
          </View>

          {/* Stok & Stok Minimum */}
          <View className="mb-5 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12.5px] text-black">
                {isNew ? 'Stok Awal' : 'Stok Saat Ini'}
              </Text>
              {isNew ? (
                <Controller
                  control={control}
                  name="stock"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                      onBlur={onBlur}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#09090B"
                      className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-extrabold text-[14px] text-black"
                    />
                  )}
                />
              ) : (
                <Pressable
                  onPress={() => productId && router.push(`/stok/${productId}`)}
                  className="flex-row items-center justify-between rounded-control border-[1.5px] border-dashed border-black bg-white px-3.5 py-3"
                >
                  <Text className="font-extrabold text-[14px] text-black">
                    {existingProduct?.stock ?? 0}
                  </Text>
                  <Text className="font-bold text-[11px] text-red">Ubah Stok</Text>
                </Pressable>
              )}
            </View>

            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12.5px] text-black">
                Stok Minimum
              </Text>
              <Controller
                control={control}
                name="min_stock"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                    onBlur={onBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#09090B"
                    className="rounded-control border-[1.5px] border-black bg-white px-3.5 py-3 font-extrabold text-[14px] text-black"
                  />
                )}
              />
            </View>
          </View>

          {/* Submit CTA */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
            className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-red bg-red py-3.5"
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
            )}
            <Text className="font-extrabold text-[14px] text-white">
              {saveMutation.isPending
                ? 'Menyimpan...'
                : isNew
                  ? 'Simpan Barang'
                  : 'Simpan Perubahan'}
            </Text>
          </Pressable>

          {/* Delete Button on Edit Mode */}
          {!isNew ? (
            <Pressable
              onPress={confirmDelete}
              disabled={deleteMutation.isPending}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3.5"
            >
              <FontAwesome6 name="trash" size={14} color="#D91E2A" solid />
              <Text className="font-extrabold text-[13.5px] text-red">
                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus Barang'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <CameraBarcodeModal
        visible={scannerOpen}
        title="Scan Barcode Barang"
        closeOnScan
        onScan={(code) => setValue('barcode', code, { shouldDirty: true })}
        onClose={() => setScannerOpen(false)}
      />
    </SafeAreaView>
  );
}
