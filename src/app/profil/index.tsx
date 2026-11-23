import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const hydratePrinter = usePrinterStore((s) => s.hydrate);

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
    void hydratePrinter();
  }, [hydratePrinter]);

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
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-black bg-white"
        >
          <FontAwesome6 name="chevron-left" size={15} color="#09090B" solid />
        </Pressable>
        <Text className="font-extrabold text-[16px] text-black">Profil &amp; Pengaturan</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Akun Google */}
        <View className="mb-4 flex-row items-center gap-3.5 rounded-card border-[1.5px] border-black bg-white p-4">
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              className="h-16 w-16 rounded-full border-[1.5px] border-black"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-red">
              <FontAwesome6 name="store" size={22} color="#FFFFFF" solid />
            </View>
          )}

          <View className="flex-1">
            <Text className="font-extrabold text-[15px] text-black" numberOfLines={1}>
              {store?.name ?? 'Toko Saya'}
            </Text>
            <Text className="mt-0.5 font-medium text-[12px] text-black" numberOfLines={1}>
              {user?.email ?? '-'}
            </Text>
            <Pressable
              onPress={() => void handlePickLogo()}
              disabled={uploadLogo.isPending}
              className="mt-2 self-start rounded-chip border-[1.5px] border-black bg-white px-3 py-1"
            >
              <Text className="font-extrabold text-[11px] text-black">
                {uploadLogo.isPending ? 'Mengunggah...' : 'Ubah Logo Toko'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Form Profil Toko & Struk */}
        <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="mb-3 font-extrabold text-[14.5px] text-black">
            Informasi Toko &amp; Struk
          </Text>

          <Text className="mb-1 font-bold text-[12px] text-black">Nama Toko *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Toko Saya"
            placeholderTextColor="#09090B"
            className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-semibold text-[13px] text-black"
          />

          <Text className="mb-1 font-bold text-[12px] text-black">Alamat Toko</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Jl. Contoh No. 10"
            placeholderTextColor="#09090B"
            className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1 font-bold text-[12px] text-black">No. HP / WhatsApp</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0812xxxxxxxx"
            placeholderTextColor="#09090B"
            className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1 font-bold text-[12px] text-black">Teks Footer Struk</Text>
          <TextInput
            value={receiptFooter}
            onChangeText={setReceiptFooter}
            placeholder="Terima kasih telah berbelanja!"
            placeholderTextColor="#09090B"
            className="mb-3 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-medium text-[13px] text-black"
          />

          <Text className="mb-1.5 font-bold text-[12px] text-black">
            Ukuran Kertas Thermal
          </Text>
          <View className="mb-4 flex-row gap-2.5">
            {([58, 80] as PaperSize[]).map((size) => {
              const active = paperSize === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => setPaperSize(size)}
                  className={`flex-1 items-center rounded-chip border-[1.5px] py-2.5 ${
                    active ? 'border-red bg-red' : 'border-black bg-white'
                  }`}
                >
                  <Text
                    className={`font-extrabold text-[12.5px] ${
                      active ? 'text-white' : 'text-black'
                    }`}
                  >
                    {size}mm ({size === 58 ? '32 kar' : '48 kar'})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => void handleSaveProfile()}
            disabled={updateProfile.isPending}
            className="flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
            )}
            <Text className="font-extrabold text-[13.5px] text-white">
              {updateProfile.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Text>
          </Pressable>
        </View>

        {/* Pengaturan Printer Thermal Bluetooth */}
        <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="font-extrabold text-[14.5px] text-black">
            Printer Thermal Bluetooth
          </Text>
          <Text className="mt-1 font-medium text-[12px] text-black">
            {selectedPrinter
              ? `${selectedPrinter.deviceName} (${selectedPrinter.macAddress})`
              : 'Belum ada printer dipilih. Transaksi tetap dapat dilakukan dan dibagikan sebagai PDF.'}
          </Text>

          <View className="mt-3.5 flex-row gap-2.5">
            <Pressable
              onPress={() => setPrinterModalOpen(true)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
            >
              <FontAwesome6 name="print" size={13} color="#09090B" solid />
              <Text className="font-extrabold text-[12.5px] text-black">
                {selectedPrinter ? 'Ganti Printer' : 'Pilih Printer'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleTestPrint()}
              disabled={isTestingPrint}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-red bg-red py-3"
            >
              {isTestingPrint ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="receipt" size={13} color="#FFFFFF" solid />
              )}
              <Text className="font-extrabold text-[12.5px] text-white">Tes Cetak</Text>
            </Pressable>
          </View>
        </View>

        {/* Shortcut Kategori Pengeluaran & Logout */}
        <View className="mb-5 gap-2.5">
          <Pressable
            onPress={() => router.push('/keuangan')}
            className="flex-row items-center justify-between rounded-card border-[1.5px] border-black bg-white px-4 py-3.5"
          >
            <View className="flex-row items-center gap-3">
              <FontAwesome6 name="tags" size={15} color="#09090B" solid />
              <Text className="font-extrabold text-[13.5px] text-black">
                Kelola Kategori Pengeluaran
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={13} color="#09090B" solid />
          </Pressable>

          <Pressable
            onPress={() => void signOut()}
            className="flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3.5"
          >
            <FontAwesome6 name="right-from-bracket" size={14} color="#09090B" solid />
            <Text className="font-extrabold text-[13.5px] text-black">Keluar (Logout)</Text>
          </Pressable>
        </View>

        {/* Zona Berbahaya: Hapus Akun Permanen (PRD 3.11) */}
        <View className="rounded-card border-[1.5px] border-red bg-white p-4">
          <Text className="font-extrabold text-[14px] text-red">Hapus Akun Permanen</Text>
          <Text className="mt-1 font-medium text-[12px] text-black">
            Menghapus permanen seluruh data toko, barang, transaksi, riwayat stok, pengeluaran, logo, dan akun Google Anda. Tindakan ini tidak dapat dipulihkan.
          </Text>
          <Pressable
            onPress={() => {
              setConfirmStoreName('');
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
            className="mt-3.5 flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
          >
            <FontAwesome6 name="trash" size={13} color="#FFFFFF" solid />
            <Text className="font-extrabold text-[13px] text-white">Hapus Akun Permanen</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal Konfirmasi 2 Langkah Hapus Akun Permanen */}
      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
            <Text className="font-extrabold text-[17px] text-red">
              Konfirmasi Hapus Akun
            </Text>
            <Text className="mt-1.5 font-medium text-[12.5px] text-black">
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
              placeholderTextColor="#09090B"
              className="mt-3.5 rounded-control border-[1.5px] border-black bg-white px-3.5 py-2.5 font-bold text-[13.5px] text-black"
            />

            {deleteError ? (
              <Text className="mt-2 font-bold text-[12px] text-red">{deleteError}</Text>
            ) : null}

            <View className="mt-4 gap-2">
              <Pressable
                onPress={() => void handleConfirmDeleteAccount()}
                disabled={!exactStoreNameMatch || deleteAccount.isPending}
                className={`flex-row items-center justify-center gap-2 rounded-control border-[1.5px] py-3.5 ${
                  exactStoreNameMatch && !deleteAccount.isPending
                    ? 'border-red bg-red'
                    : 'border-dashed border-black bg-white'
                }`}
              >
                {deleteAccount.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome6
                    name="trash"
                    size={13}
                    color={exactStoreNameMatch ? '#FFFFFF' : '#09090B'}
                    solid
                  />
                )}
                <Text
                  className={`font-extrabold text-[13.5px] ${
                    exactStoreNameMatch ? 'text-white' : 'text-black'
                  }`}
                >
                  {deleteAccount.isPending ? 'Menghapus...' : 'Hapus Permanen Sekarang'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDeleteModalOpen(false)}
                disabled={deleteAccount.isPending}
                className="items-center rounded-control border-[1.5px] border-black bg-white py-3"
              >
                <Text className="font-extrabold text-[13px] text-black">Batal</Text>
              </Pressable>
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
