import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { CameraBarcodeModal } from '@/components/scanner/CameraBarcodeModal';
import { useAuth } from '@/hooks/useAuth';
import {
  useDeleteProductMutation,
  useProductByIdQuery,
  useSaveProductMutation,
  useUploadProductImageMutation,
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

  const { user, store } = useAuth();
  const { data: existingProduct, isLoading } = useProductByIdQuery(
    isNew ? undefined : productId,
  );
  const saveMutation = useSaveProductMutation();
  const deleteMutation = useDeleteProductMutation();
  const uploadImageMutation = useUploadProductImageMutation();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
      setImageUrl(existingProduct.image_url ?? null);
    }
  }, [existingProduct, reset]);

  const handlePickImage = async (source: 'gallery' | 'camera') => {
    if (!user?.id) {
      setSubmitError('Sesi pengguna tidak ditemukan.');
      return;
    }

    setSubmitError(null);
    if (source === 'gallery') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Galeri', 'Izinkan akses galeri untuk memilih foto produk.');
        return;
      }
    } else {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Kamera', 'Izinkan akses kamera untuk memotret foto produk.');
        return;
      }
    }

    const result =
      source === 'gallery'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    try {
      const asset = result.assets[0];
      const publicUrl = await uploadImageMutation.mutateAsync({
        userId: user.id,
        localUri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setImageUrl(publicUrl);
    } catch (err) {
      Alert.alert(
        'Gagal Unggah Foto',
        err instanceof Error ? err.message : 'Tidak dapat mengunggah foto produk.',
      );
    }
  };

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
        image_url: imageUrl,
        previous_image_url: existingProduct?.image_url ?? null,
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
                const res = await deleteMutation.mutateAsync({
                  productId,
                  imageUrl: existingProduct?.image_url ?? null,
                });
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
          <MotionPressable
            onPress={() => router.back()}
            accessibilityLabel="Kembali"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <FontAwesome6 name="chevron-left" size={14} color="#09090B" solid />
          </MotionPressable>
          <Text className="font-extrabold text-[16px] tracking-[-0.02em] text-black">
            {isNew ? 'Tambah Barang' : 'Edit Barang'}
          </Text>
          {!isNew && productId ? (
            <MotionPressable
              onPress={() => router.push(`/stok/${productId}`)}
              accessibilityLabel="Kelola stok barang"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <FontAwesome6 name="boxes-stacked" size={14} color="#09090B" solid />
            </MotionPressable>
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
            <View className="mb-3.5 flex-row items-center gap-2 rounded-control bg-red-soft px-4 py-3">
              <FontAwesome6 name="triangle-exclamation" size={14} color="#D91E2A" solid />
              <Text className="flex-1 font-semibold text-[12px] text-red">{submitError}</Text>
            </View>
          ) : null}

          {/* Foto Produk (Opsional — Galeri & Kamera) */}
          <View className="mb-4 flex-row items-center gap-3.5 rounded-card border border-border bg-white p-3.5">
            <View
              className={`h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[14px] bg-surface ${
                imageUrl ? 'border border-border' : 'border border-dashed border-border'
              }`}
            >
              {uploadImageMutation.isPending ? (
                <ActivityIndicator size="small" color="#D91E2A" />
              ) : imageUrl ? (
                <Image
                  source={imageUrl}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
              ) : (
                <View className="items-center gap-1">
                  <FontAwesome6 name="image" size={18} color="#71717A" solid />
                  <Text className="font-bold text-[10px] text-muted">Tanpa Foto</Text>
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text className="font-extrabold text-[13.5px] text-black">
                Foto Produk (Opsional)
              </Text>
              <Text className="mt-0.5 font-medium text-[11.5px] leading-4 text-muted">
                Tampil di Daftar Barang &amp; Katalog Kasir. Maks 2 MB.
              </Text>

              <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                <MotionPressable
                  onPress={() => void handlePickImage('gallery')}
                  disabled={uploadImageMutation.isPending}
                  className="flex-row items-center gap-1.5 rounded-[9px] bg-red px-2.5 py-1.5"
                >
                  <FontAwesome6 name="image" size={11} color="#FFFFFF" solid />
                  <Text className="font-bold text-[11.5px] text-white">Galeri</Text>
                </MotionPressable>

                <MotionPressable
                  onPress={() => void handlePickImage('camera')}
                  disabled={uploadImageMutation.isPending}
                  className="flex-row items-center gap-1.5 rounded-[9px] border border-border bg-white px-2.5 py-1.5"
                >
                  <FontAwesome6 name="camera" size={11} color="#09090B" solid />
                  <Text className="font-bold text-[11.5px] text-black">Kamera</Text>
                </MotionPressable>

                {imageUrl ? (
                  <MotionPressable
                    onPress={() => setImageUrl(null)}
                    disabled={uploadImageMutation.isPending}
                    className="rounded-[9px] bg-red-soft px-2.5 py-1.5"
                  >
                    <Text className="font-bold text-[11.5px] text-red">Hapus</Text>
                  </MotionPressable>
                ) : null}
              </View>
            </View>
          </View>

          {/* Nama Barang */}
          <View className="mb-3.5">
            <Text className="mb-1.5 font-bold text-[12px] text-black">Nama Barang *</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Contoh: Indomie Goreng Original"
                  placeholderTextColor="#71717A"
                  className="rounded-control bg-surface px-3.5 py-3 font-semibold text-[13.5px] text-black"
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
            <Text className="mb-1.5 font-bold text-[12px] text-black">
              Barcode (Opsional — Kamera, HID, atau Ketik)
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
                    placeholderTextColor="#71717A"
                    className="flex-1 rounded-control bg-surface px-3.5 py-3 font-semibold text-[13.5px] text-black"
                  />
                )}
              />
              <MotionPressable
                onPress={() => setScannerOpen(true)}
                accessibilityLabel="Pindai barcode dengan kamera"
                className="h-[46px] w-[46px] items-center justify-center rounded-control bg-red"
              >
                <FontAwesome6 name="camera" size={16} color="#FFFFFF" solid />
              </MotionPressable>
            </View>
          </View>

          {/* Kategori */}
          <View className="mb-3.5">
            <Text className="mb-1.5 font-bold text-[12px] text-black">Kategori (Opsional)</Text>
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Contoh: Makanan, Minuman, Sembako"
                  placeholderTextColor="#71717A"
                  className="rounded-control bg-surface px-3.5 py-3 font-semibold text-[13.5px] text-black"
                />
              )}
            />
          </View>

          {/* Harga Jual & Harga Modal */}
          <View className="mb-3.5 flex-row gap-2.5">
            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12px] text-black">Harga Jual (Rp) *</Text>
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
                    placeholderTextColor="#71717A"
                    className="rounded-control bg-surface px-3.5 py-3 font-extrabold text-[14px] text-black"
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
              <Text className="mb-1.5 font-bold text-[12px] text-black">Harga Modal (Rp)</Text>
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
                    placeholderTextColor="#71717A"
                    className="rounded-control bg-surface px-3.5 py-3 font-extrabold text-[14px] text-black"
                  />
                )}
              />
            </View>
          </View>

          {/* Stok & Stok Minimum */}
          <View className="mb-5 flex-row gap-2.5">
            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12px] text-black">
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
                      placeholderTextColor="#71717A"
                      className="rounded-control bg-surface px-3.5 py-3 font-extrabold text-[14px] text-black"
                    />
                  )}
                />
              ) : (
                <MotionPressable
                  onPress={() => productId && router.push(`/stok/${productId}`)}
                  className="flex-row items-center justify-between rounded-control border border-border bg-white px-3.5 py-3"
                >
                  <Text
                    className="font-extrabold text-[14px] text-black"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {existingProduct?.stock ?? 0}
                  </Text>
                  <Text className="font-bold text-[11.5px] text-red">Ubah Stok</Text>
                </MotionPressable>
              )}
            </View>

            <View className="flex-1">
              <Text className="mb-1.5 font-bold text-[12px] text-black">Stok Minimum</Text>
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
                    placeholderTextColor="#71717A"
                    className="rounded-control bg-surface px-3.5 py-3 font-extrabold text-[14px] text-black"
                  />
                )}
              />
            </View>
          </View>

          {/* Submit CTA */}
          <MotionPressable
            onPress={handleSubmit(onSubmit)}
            disabled={saveMutation.isPending || uploadImageMutation.isPending}
            className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
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
          </MotionPressable>

          {/* Delete Button on Edit Mode */}
          {!isNew ? (
            <MotionPressable
              onPress={confirmDelete}
              disabled={deleteMutation.isPending}
              className="mt-3 min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red-soft py-3"
            >
              <FontAwesome6 name="trash" size={13} color="#D91E2A" solid />
              <Text className="font-extrabold text-[13.5px] text-red">
                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus Barang'}
              </Text>
            </MotionPressable>
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
