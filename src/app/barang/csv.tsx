import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  useImportProductsCsvMutation,
  useProductsQuery,
} from '@/hooks/useProducts';
import {
  generateProductsCsv,
  getProductsCsvTemplate,
  parseProductsCsv,
  type CsvParseResult,
} from '@/lib/csvProducts';
import { formatLocalDateKey, formatRupiah } from '@/lib/format';

type PreviewTab = 'valid' | 'error';

export default function CsvProductsScreen() {
  const router = useRouter();
  const { store } = useAuth();
  const { data: products = [] } = useProductsQuery(store?.id);
  const importMutation = useImportProductsCsvMutation();

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('valid');
  const [isExporting, setIsExporting] = useState(false);

  const shareCsvFile = async (filename: string, content: string) => {
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) {
      Alert.alert('Gagal', 'Direktori penyimpanan sementara tidak tersedia.');
      return;
    }

    const fileUri = `${dir}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Berhasil', `File disimpan di: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: filename,
      UTI: 'public.comma-separated-values-text',
    });
  };

  const handleExportProducts = async () => {
    setIsExporting(true);
    try {
      const csv = generateProductsCsv(products);
      const filename = `barang-src-dimas-${formatLocalDateKey()}.csv`;
      await shareCsvFile(filename, csv);
    } catch (err) {
      Alert.alert(
        'Gagal Ekspor CSV',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mengekspor data.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await shareCsvFile('template-barang-src-dimas-kasir.csv', getProductsCsvTemplate());
    } catch (err) {
      Alert.alert(
        'Gagal Membuat Template',
        err instanceof Error ? err.message : 'Tidak dapat membuat file template.',
      );
    }
  };

  const handlePickCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const text = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = parseProductsCsv(text);
      setSelectedFileName(file.name);
      setPreview(parsed);
      setPreviewTab(parsed.errorRows.length > 0 && parsed.validRows.length === 0 ? 'error' : 'valid');
    } catch (err) {
      Alert.alert(
        'Gagal Membaca CSV',
        err instanceof Error ? err.message : 'File tidak dapat dibaca.',
      );
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.validRows.length === 0) return;

    try {
      const res = await importMutation.mutateAsync(
        preview.validRows.map((row) => row.data),
      );
      Alert.alert(
        'Impor CSV Selesai',
        `Ditambahkan: ${res.inserted} barang\nDiperbarui: ${res.updated} barang\nMutasi stok dicatat: ${res.stock_adjusted}`,
      );
      setPreview(null);
      setSelectedFileName(null);
      router.back();
    } catch (err) {
      Alert.alert(
        'Gagal Impor CSV',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mengimpor data.',
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
        <Text className="font-extrabold text-[16px] text-black">Import &amp; Export CSV</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Export & Template Card */}
        <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="font-extrabold text-[14.5px] text-black">
            Export &amp; Template Standar
          </Text>
          <Text className="mt-1 font-medium text-[12px] text-black">
            Kolom wajib: nama, harga_jual. Kolom lengkap: nama, barcode, kategori, harga_jual, harga_modal, stok, stok_minimum (maks 1.000 baris).
          </Text>

          <View className="mt-3.5 flex-row gap-2.5">
            <Pressable
              onPress={() => void handleExportProducts()}
              disabled={isExporting}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
            >
              <FontAwesome6 name="download" size={13} color="#09090B" solid />
              <Text className="font-extrabold text-[12.5px] text-black">
                {isExporting ? 'Mengekspor...' : `Export (${products.length})`}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleDownloadTemplate()}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-black bg-white py-3"
            >
              <FontAwesome6 name="file-arrow-down" size={13} color="#09090B" solid />
              <Text className="font-extrabold text-[12.5px] text-black">Template CSV</Text>
            </Pressable>
          </View>
        </View>

        {/* Import Picker Card */}
        <View className="mb-4 rounded-card border-[1.5px] border-black bg-white p-4">
          <Text className="font-extrabold text-[14.5px] text-black">Import Barang dari CSV</Text>
          <Text className="mt-1 font-medium text-[12px] text-black">
            Barcode yang sudah ada akan di-update (upsert). Perubahan stok otomatis dicatat di riwayat stok sebagai &quot;Import CSV&quot;.
          </Text>

          <Pressable
            onPress={() => void handlePickCsv()}
            className="mt-3.5 flex-row items-center justify-center gap-2 rounded-control border-[1.5px] border-red bg-red py-3.5"
          >
            <FontAwesome6 name="file-arrow-up" size={14} color="#FFFFFF" solid />
            <Text className="font-extrabold text-[13.5px] text-white">
              {selectedFileName ? 'Pilih File CSV Lain' : 'Pilih File CSV'}
            </Text>
          </Pressable>

          {selectedFileName ? (
            <Text className="mt-2 font-semibold text-[11.5px] text-black">
              File dipilih: {selectedFileName}
            </Text>
          ) : null}
        </View>

        {/* Preview Section */}
        {preview ? (
          <View>
            {preview.fatalError ? (
              <View className="rounded-card bg-red p-4">
                <Text className="font-extrabold text-[14px] text-white">
                  File CSV Tidak Dapat Diproses
                </Text>
                <Text className="mt-1 font-medium text-[12.5px] text-white">
                  {preview.fatalError}
                </Text>
              </View>
            ) : (
              <>
                {/* Summary 2-Column KPI */}
                <View className="mb-3 flex-row gap-3">
                  <View className="flex-1 rounded-card border-[1.5px] border-black bg-white p-3.5">
                    <Text className="font-semibold text-[12px] text-black">Baris Valid</Text>
                    <Text className="mt-1 font-extrabold text-[22px] text-black">
                      {preview.validRows.length}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-card border-[1.5px] border-red bg-red p-3.5">
                    <Text className="font-semibold text-[12px] text-white">Baris Error</Text>
                    <Text className="mt-1 font-extrabold text-[22px] text-white">
                      {preview.errorRows.length}
                    </Text>
                  </View>
                </View>

                {/* Preview Tabs */}
                <View className="mb-3 flex-row gap-2">
                  <Pressable
                    onPress={() => setPreviewTab('valid')}
                    className={`flex-1 items-center rounded-chip border-[1.5px] py-2 ${
                      previewTab === 'valid'
                        ? 'border-black bg-black'
                        : 'border-black bg-white'
                    }`}
                  >
                    <Text
                      className={`font-extrabold text-[12px] ${
                        previewTab === 'valid' ? 'text-white' : 'text-black'
                      }`}
                    >
                      Valid ({preview.validRows.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPreviewTab('error')}
                    className={`flex-1 items-center rounded-chip border-[1.5px] py-2 ${
                      previewTab === 'error'
                        ? 'border-red bg-red'
                        : 'border-black bg-white'
                    }`}
                  >
                    <Text
                      className={`font-extrabold text-[12px] ${
                        previewTab === 'error' ? 'text-white' : 'text-black'
                      }`}
                    >
                      Error ({preview.errorRows.length})
                    </Text>
                  </Pressable>
                </View>

                {/* Confirm Partial/Full Import CTA */}
                {preview.validRows.length > 0 ? (
                  <Pressable
                    onPress={() => void handleConfirmImport()}
                    disabled={importMutation.isPending}
                    className="mb-3.5 flex-row items-center justify-center gap-2 rounded-control bg-red py-3.5"
                  >
                    {importMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
                    )}
                    <Text className="font-extrabold text-[13.5px] text-white">
                      {importMutation.isPending
                        ? 'Mengimpor...'
                        : `Impor ${preview.validRows.length} Baris Valid`}
                    </Text>
                  </Pressable>
                ) : null}

                {/* Rows List */}
                {previewTab === 'valid' ? (
                  <View className="gap-2">
                    {preview.validRows.slice(0, 50).map((row) => (
                      <View
                        key={`v-${row.rowNumber}`}
                        className="flex-row items-center justify-between rounded-card border-[1.5px] border-black bg-white px-3.5 py-2.5"
                      >
                        <View className="flex-1 pr-2">
                          <Text className="font-extrabold text-[13px] text-black">
                            Baris {row.rowNumber}: {row.data.name}
                          </Text>
                          <Text className="mt-0.5 font-medium text-[11.5px] text-black">
                            {row.data.barcode ?? 'Tanpa barcode'} • Stok {row.data.stock ?? 0}
                          </Text>
                        </View>
                        <Text className="font-extrabold text-[13px] text-black">
                          {formatRupiah(row.data.sell_price)}
                        </Text>
                      </View>
                    ))}
                    {preview.validRows.length > 50 ? (
                      <Text className="text-center font-semibold text-[11.5px] text-black">
                        Menampilkan 50 dari {preview.validRows.length} baris valid.
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View className="gap-2">
                    {preview.errorRows.length === 0 ? (
                      <View className="rounded-card border-[1.5px] border-black bg-white p-4">
                        <Text className="font-medium text-[12.5px] text-black">
                          Tidak ada baris error. Seluruh data siap diimpor.
                        </Text>
                      </View>
                    ) : (
                      preview.errorRows.map((row) => (
                        <View
                          key={`e-${row.rowNumber}`}
                          className="rounded-card bg-red px-3.5 py-3"
                        >
                          <Text className="font-extrabold text-[13px] text-white">
                            Baris {row.rowNumber}: {row.rawName}
                          </Text>
                          <Text className="mt-1 font-medium text-[12px] text-white">
                            {row.reasons.join(' • ')}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
