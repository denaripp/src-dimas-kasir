import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { PrinterPickerModal } from '@/components/printer/PrinterPickerModal';
import { useAuth } from '@/hooks/useAuth';
import {
  useDeleteAccountMutation,
  useUpdateStoreProfileMutation,
  useUploadStoreLogoMutation,
} from '@/hooks/useStoreProfile';
import { printTestReceiptBluetooth } from '@/lib/printer';
import { usePrinterStore } from '@/store/usePrinterStore';
import type { PaperSize } from '@/types/database';

export default function ProfilScreen() {
  const router = useRouter();
  const { user, store, signOut } = useAuth();
  const updateProfile = useUpdateStoreProfileMutation();
  const uploadLogo = useUploadStoreLogoMutation();
  const deleteAccount = useDeleteAccountMutation();

  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);

  const [name, setName] = useState(store?.name ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [phone, setPhone] = useState(store?.phone ?? '');
  const [receiptFooter, setReceiptFooter] = useState(
    store?.receipt_footer ?? 'Terima kasih telah berbelanja!',
  );
  const [paperSize, setPaperSize] = useState<PaperSize>(store?.paper_size ?? 58);
  const [logoUrl, setLogoUrl] = useState<string | null>(store?.logo_url ?? null);

  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [isTestingPrint, setIsTestingPrint] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmStoreName, setConfirmStoreName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setName(store.name);
      setAddress(store.address);
      setPhone(store.phone);
      setReceiptFooter(store.receipt_footer);
      setPaperSize(store.paper_size);
      setLogoUrl(store.logo_url);
    }
  }, [store]);

  const handlePickLogo = async () => {
    if (!user?.id || !store?.id) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Galeri', 'Izinkan akses galeri untuk memilih logo toko.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (picked.canceled || !picked.assets?.[0]) return;

    try {
      const asset = picked.assets[0];
      const publicUrl = await uploadLogo.mutateAsync({
        userId: user.id,
        localUri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setLogoUrl(publicUrl);
      await updateProfile.mutateAsync({
        storeId: store.id,
        name: name || store.name,
        address,
        phone,
        receiptFooter,
        paperSize,
        logoUrl: publicUrl,
        previousLogoUrl: store.logo_url ?? null,
      });
      Alert.alert('Berhasil', 'Logo toko diperbarui.');
    } catch (err) {
      Alert.alert(
        'Gagal Unggah Logo',
        err instanceof Error ? err.message : 'Tidak dapat mengunggah logo toko.',
      );
    }
  };

  const handleSaveProfile = async () => {
    if (!store?.id) return;
    try {
      await updateProfile.mutateAsync({
        storeId: store.id,
        name,
        address,
        phone,
        receiptFooter,
        paperSize,
        logoUrl,
      });
      Alert.alert('Tersimpan', 'Profil toko dan pengaturan struk berhasil diperbarui.');
    } catch (err) {
      Alert.alert(
        'Gagal Menyimpan',
        err instanceof Error ? err.message : 'Periksa kembali data profil Anda.',
      );
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      setPrinterModalOpen(true);
      return;
    }

    setIsTestingPrint(true);
    try {
      await printTestReceiptBluetooth(
        { name: name || store?.name || 'Toko Saya', paper_size: paperSize },
        selectedPrinter.macAddress,
      );
      Alert.alert('Tes Cetak Berhasil', 'Slip tes cetak dikirim ke printer Bluetooth.');
    } catch (err) {
      Alert.alert(
        'Tes Cetak Gagal',
        err instanceof Error ? err.message : 'Printer tidak terhubung.',
      );
    } finally {
      setIsTestingPrint(false);
    }
  };

  const exactStoreNameMatch =
    Boolean(store?.name) && confirmStoreName.trim() === store!.name.trim();

  const handleConfirmDeleteAccount = async () => {
    if (!exactStoreNameMatch) return;
    setDeleteError(null);
    try {
      await deleteAccount.mutateAsync(confirmStoreName);
      setDeleteModalOpen(false);
      router.replace('/(auth)/login');
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Gagal menghapus akun secara permanen.',
      );
    }
  };

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
          Profil Toko &amp; Printer
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Akun Google */}
        <View className="mb-3.5 flex-row items-center gap-3.5 rounded-card border border-border bg-white p-4">
          {logoUrl ? (
            <Image
              source={logoUrl}
              style={{ width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#E4E4E7' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-red">
              <FontAwesome6 name="store" size={20} color="#FFFFFF" solid />
            </View>
          )}

          <View className="flex-1">
            <Text className="font-extrabold text-[15px] text-black" numberOfLines={1}>
              {store?.name ?? 'Toko Saya'}
            </Text>
            <Text className="mt-0.5 font-medium text-[12px] text-muted" numberOfLines={1}>
              {user?.email ?? '-'}
            </Text>
            <MotionPressable
              onPress={() => void handlePickLogo()}
              disabled={uploadLogo.isPending}
              className="mt-2 self-start rounded-[9px] border border-border bg-white px-3 py-1.5"
            >
              <Text className="font-bold text-[11.5px] text-black">
                {uploadLogo.isPending ? 'Mengunggah...' : 'Ubah Logo Toko'}
              </Text>
            </MotionPressable>
          </View>
        </View>

        {/* Form Profil Toko & Struk */}
        <View className="mb-3.5 rounded-card border border-border bg-white p-4">
          <Text className="mb-3 font-extrabold text-[14px] text-black">
            Informasi Toko &amp; Struk
          </Text>

          <Text className="mb-1.5 font-bold text-[12px] text-black">Nama Toko *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Toko Saya"
            placeholderTextColor="#71717A"
            className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-semibold text-[13px] text-black"
          />

          <Text className="mb-1.5 font-bold text-[12px] text-black">Alamat Toko</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Jl. Contoh No. 10"
            placeholderTextColor="#71717A"
            className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1.5 font-bold text-[12px] text-black">No. HP / WhatsApp</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0812xxxxxxxx"
            placeholderTextColor="#71717A"
            className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1.5 font-bold text-[12px] text-black">Teks Footer Struk</Text>
          <TextInput
            value={receiptFooter}
            onChangeText={setReceiptFooter}
            placeholder="Terima kasih telah berbelanja!"
            placeholderTextColor="#71717A"
            className="mb-3 rounded-control bg-surface px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1.5 font-bold text-[12px] text-black">
            Ukuran Kertas Thermal
          </Text>
          <View className="mb-4 flex-row gap-1 rounded-[13px] bg-surface p-1">
            {([58, 80] as PaperSize[]).map((size) => {
              const active = paperSize === size;
              return (
                <MotionPressable
                  key={size}
                  wrapperClassName="flex-1"
                  onPress={() => setPaperSize(size)}
                  scaleTo={0.97}
                  className={`items-center rounded-[9px] py-2 ${active ? 'bg-white' : ''}`}
                >
                  <Text
                    className={`font-bold text-[12px] ${
                      active ? 'text-black' : 'text-muted'
                    }`}
                  >
                    {size}mm ({size === 58 ? '32 kar' : '48 kar'})
                  </Text>
                </MotionPressable>
              );
            })}
          </View>

          <MotionPressable
            onPress={() => void handleSaveProfile()}
            disabled={updateProfile.isPending}
            className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
            )}
            <Text className="font-extrabold text-[13.5px] text-white">
              {updateProfile.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Text>
          </MotionPressable>
        </View>

        {/* Pengaturan Printer Thermal Bluetooth */}
        <View className="mb-3.5 rounded-card border border-border bg-white p-4">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-extrabold text-[14px] text-black">
                Printer Thermal Bluetooth
              </Text>
              <Text className="mt-1 font-medium text-[12px] leading-4 text-muted">
                {selectedPrinter
                  ? `${selectedPrinter.deviceName} (${selectedPrinter.macAddress})`
                  : 'Belum ada printer dipilih. Struk tetap bisa dibagikan sebagai PDF.'}
              </Text>
            </View>
            {selectedPrinter ? (
              <View className="rounded-[7px] bg-surface px-2 py-0.5">
                <Text className="font-bold text-[10.5px] text-muted">Terpilih</Text>
              </View>
            ) : null}
          </View>

          <View className="mt-3.5 flex-row gap-2.5">
            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => setPrinterModalOpen(true)}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
            >
              <FontAwesome6 name="print" size={13} color="#09090B" solid />
              <Text className="font-bold text-[12.5px] text-black">
                {selectedPrinter ? 'Ganti Printer' : 'Pilih Printer'}
              </Text>
            </MotionPressable>

            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => void handleTestPrint()}
              disabled={isTestingPrint}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
            >
              {isTestingPrint ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="receipt" size={13} color="#FFFFFF" solid />
              )}
              <Text className="font-extrabold text-[12.5px] text-white">Tes Cetak</Text>
            </MotionPressable>
          </View>
        </View>

        {/* Shortcut Kategori Pengeluaran & Logout */}
        <View className="mb-4 gap-2.5">
          <MotionPressable
            onPress={() => router.push('/keuangan')}
            scaleTo={0.985}
            className="flex-row items-center justify-between rounded-card border border-border bg-white px-4 py-3.5"
          >
            <View className="flex-row items-center gap-3">
              <FontAwesome6 name="tags" size={14} color="#09090B" solid />
              <Text className="font-bold text-[13.5px] text-black">
                Kelola Kategori Pengeluaran
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={12} color="#71717A" solid />
          </MotionPressable>

          <MotionPressable
            onPress={() => void signOut()}
            className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
          >
            <FontAwesome6 name="right-from-bracket" size={14} color="#09090B" solid />
            <Text className="font-bold text-[13.5px] text-black">Keluar (Logout)</Text>
          </MotionPressable>
        </View>

        {/* Zona Berbahaya: Hapus Akun Permanen (PRD 3.11) */}
        <View className="rounded-card border border-red/30 bg-white p-4">
          <Text className="font-extrabold text-[13.5px] text-red">Hapus Akun Permanen</Text>
          <Text className="mt-1 font-medium text-[12px] leading-4 text-muted">
            Menghapus permanen seluruh data toko, barang, foto produk, transaksi, riwayat stok, pengeluaran, logo, dan akun Google Anda. Tindakan ini tidak dapat dipulihkan.
          </Text>
          <MotionPressable
            onPress={() => {
              setConfirmStoreName('');
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
            className="mt-3.5 min-h-[44px] flex-row items-center justify-center gap-2 rounded-control bg-red-soft py-3"
          >
            <FontAwesome6 name="trash" size={13} color="#D91E2A" solid />
            <Text className="font-extrabold text-[13px] text-red">Hapus Akun Permanen</Text>
          </MotionPressable>
        </View>
      </ScrollView>

      {/* Modal Konfirmasi 2 Langkah Hapus Akun Permanen */}
      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full rounded-hero border border-border bg-white p-5">
            <Text className="font-extrabold text-[17px] text-red">
              Konfirmasi Hapus Akun
            </Text>
            <Text className="mt-1.5 font-medium text-[12.5px] leading-5 text-muted">
              Ketik ulang nama toko Anda secara persis:{' '}
              <Text className="font-extrabold text-black">{store?.name ?? 'Toko Saya'}</Text>
            </Text>

            <TextInput
              value={confirmStoreName}
              onChangeText={(t) => {
                setConfirmStoreName(t);
                setDeleteError(null);
              }}
              placeholder={store?.name ?? 'Toko Saya'}
              placeholderTextColor="#71717A"
              className="mt-3.5 rounded-control bg-surface px-3.5 py-2.5 font-bold text-[13.5px] text-black"
            />

            {deleteError ? (
              <Text className="mt-2 font-bold text-[12px] text-red">{deleteError}</Text>
            ) : null}

            <View className="mt-4 gap-2">
              <MotionPressable
                onPress={() => void handleConfirmDeleteAccount()}
                disabled={!exactStoreNameMatch || deleteAccount.isPending}
                className={`min-h-[46px] flex-row items-center justify-center gap-2 rounded-control py-3 ${
                  exactStoreNameMatch && !deleteAccount.isPending
                    ? 'bg-red'
                    : 'bg-surface'
                }`}
              >
                {deleteAccount.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6
                    name="trash"
                    size={13}
                    color={exactStoreNameMatch ? '#FFFFFF' : '#71717A'}
                    solid
                  />
                )}
                <Text
                  className={`font-extrabold text-[13.5px] ${
                    exactStoreNameMatch ? 'text-white' : 'text-muted'
                  }`}
                >
                  {deleteAccount.isPending ? 'Menghapus...' : 'Hapus Permanen Sekarang'}
                </Text>
              </MotionPressable>

              <MotionPressable
                onPress={() => setDeleteModalOpen(false)}
                disabled={deleteAccount.isPending}
                className="min-h-[44px] items-center justify-center rounded-control border border-border bg-white py-3"
              >
                <Text className="font-bold text-[13px] text-black">Batal</Text>
              </MotionPressable>
            </View>
          </View>
        </View>
      </Modal>

      <PrinterPickerModal
        visible={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
      />
    </SafeAreaView>
  );
}
