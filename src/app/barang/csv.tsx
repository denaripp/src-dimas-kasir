import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useAuth } from '@/hooks/useAuth';
import {
  useImportProductsCsvMutation,
  useProductsQuery,
} from '@/hooks/useProducts';
import {
  CSV_MAX_FILE_BYTES,
  generateProductsCsv,
  getProductsCsvTemplate,
  parseProductsCsv,
  type CsvParseResult,
} from '@/lib/csvProducts';
import { formatLocalDateKey, formatRupiah } from '@/lib/format';
import { shareCsvFile } from '@/lib/shareFile';

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

  const handleExportProducts = async () => {
    setIsExporting(true);
    try {
      const csv = generateProductsCsv(products);
      const filename = `barang-src-dimas-${formatLocalDateKey()}.csv`;
      const res = await shareCsvFile({ filename, content: csv });
      if (!res.shared) {
        Alert.alert('Berhasil', `File disimpan di: ${res.fileUri}`);
      }
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
      const res = await shareCsvFile({
        filename: 'template-barang-src-dimas-kasir.csv',
        content: getProductsCsvTemplate(),
      });
      if (!res.shared) {
        Alert.alert('Berhasil', `Template disimpan di: ${res.fileUri}`);
      }
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
      let fileSize = typeof file.size === 'number' ? file.size : null;
      if (fileSize === null) {
        const info = await FileSystem.getInfoAsync(file.uri);
        if (info.exists && 'size' in info && typeof info.size === 'number') {
          fileSize = info.size;
        }
      }
      if (fileSize !== null && fileSize > CSV_MAX_FILE_BYTES) {
        Alert.alert(
          'File Terlalu Besar',
          'Ukuran file CSV maksimal 2 MB agar tidak membebani memori perangkat.',
        );
        return;
      }

      const text = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = parseProductsCsv(text);
      setSelectedFileName(file.name);
      setPreview(parsed);
      setPreviewTab(
        parsed.errorRows.length > 0 && parsed.validRows.length === 0 ? 'error' : 'valid',
      );
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
        <MotionPressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="chevron-left" size={14} color="#09090B" solid />
        </MotionPressable>
        <Text className="font-extrabold text-[16px] tracking-[-0.02em] text-black">
          Import &amp; Export CSV
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1 px-[18px]"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Export & Template Card */}
        <View className="mb-3.5 rounded-card border border-border bg-white p-4">
          <Text className="font-extrabold text-[14px] text-black">
            Export &amp; Template Standar
          </Text>
          <Text className="mt-1 font-medium text-[12px] leading-4 text-muted">
            Kolom wajib: nama, harga_jual. Kolom lengkap: nama, barcode, kategori, harga_jual, harga_modal, stok, stok_minimum (maks 1.000 baris).
          </Text>

          <View className="mt-3.5 flex-row gap-2.5">
            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => void handleExportProducts()}
              disabled={isExporting}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
            >
              <FontAwesome6 name="download" size={13} color="#09090B" solid />
              <Text className="font-bold text-[12.5px] text-black">
                {isExporting ? 'Mengekspor...' : `Export (${products.length})`}
              </Text>
            </MotionPressable>

            <MotionPressable
              wrapperClassName="flex-1"
              onPress={() => void handleDownloadTemplate()}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-control border border-border bg-white py-3"
            >
              <FontAwesome6 name="file-arrow-down" size={13} color="#09090B" solid />
              <Text className="font-bold text-[12.5px] text-black">Template CSV</Text>
            </MotionPressable>
          </View>
        </View>

        {/* Import Picker Card */}
        <View className="mb-4 rounded-card border border-border bg-white p-4">
          <Text className="font-extrabold text-[14px] text-black">Import Barang dari CSV</Text>
          <Text className="mt-1 font-medium text-[12px] leading-4 text-muted">
            Barcode yang sudah ada akan di-update (upsert). Perubahan stok otomatis dicatat di riwayat stok sebagai &quot;Import CSV&quot;.
          </Text>

          <MotionPressable
            onPress={() => void handlePickCsv()}
            className="mt-3.5 min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
          >
            <FontAwesome6 name="file-arrow-up" size={14} color="#FFFFFF" solid />
            <Text className="font-extrabold text-[13.5px] text-white">
              {selectedFileName ? 'Pilih File CSV Lain' : 'Pilih File CSV'}
            </Text>
          </MotionPressable>

          {selectedFileName ? (
            <Text className="mt-2 font-semibold text-[11.5px] text-muted">
              File dipilih: {selectedFileName}
            </Text>
          ) : null}
        </View>

        {/* Preview Section */}
        {preview ? (
          <View>
            {preview.fatalError ? (
              <View className="rounded-card bg-red-soft p-4">
                <Text className="font-extrabold text-[14px] text-red">
                  File CSV Tidak Dapat Diproses
                </Text>
                <Text className="mt-1 font-medium text-[12.5px] text-red">
                  {preview.fatalError}
                </Text>
              </View>
            ) : (
              <>
                {/* Summary 2-Column Soft Tiles */}
                <View className="mb-3 flex-row gap-2.5">
                  <View className="flex-1 rounded-card bg-surface p-3.5">
                    <Text className="font-semibold text-[12px] text-muted">Baris Valid</Text>
                    <Text
                      className="mt-1 font-extrabold text-[22px] text-black"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {preview.validRows.length}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-card bg-red-soft p-3.5">
                    <Text className="font-semibold text-[12px] text-red">Baris Error</Text>
                    <Text
                      className="mt-1 font-extrabold text-[22px] text-red"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {preview.errorRows.length}
                    </Text>
                  </View>
                </View>

                {/* Segmented Preview Tabs */}
                <View className="mb-3 flex-row gap-1 rounded-[13px] bg-surface p-1">
                  <MotionPressable
                    wrapperClassName="flex-1"
                    onPress={() => setPreviewTab('valid')}
                    scaleTo={0.97}
                    className={`items-center rounded-[9px] py-2 ${
                      previewTab === 'valid' ? 'bg-white' : ''
                    }`}
                  >
                    <Text
                      className={`font-bold text-[12px] ${
                        previewTab === 'valid' ? 'text-black' : 'text-muted'
                      }`}
                    >
                      Valid ({preview.validRows.length})
                    </Text>
                  </MotionPressable>
                  <MotionPressable
                    wrapperClassName="flex-1"
                    onPress={() => setPreviewTab('error')}
                    scaleTo={0.97}
                    className={`items-center rounded-[9px] py-2 ${
                      previewTab === 'error' ? 'bg-white' : ''
                    }`}
                  >
                    <Text
                      className={`font-bold text-[12px] ${
                        previewTab === 'error' ? 'text-red' : 'text-muted'
                      }`}
                    >
                      Error ({preview.errorRows.length})
                    </Text>
                  </MotionPressable>
                </View>

                {/* Confirm Import CTA */}
                {preview.validRows.length > 0 ? (
                  <MotionPressable
                    onPress={() => void handleConfirmImport()}
                    disabled={importMutation.isPending}
                    className="mb-3.5 min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
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
                  </MotionPressable>
                ) : null}

                {/* Rows List */}
                {previewTab === 'valid' ? (
                  <View className="overflow-hidden rounded-card border border-border bg-white">
                    {preview.validRows.slice(0, 50).map((row, idx) => {
                      const isLast = idx === Math.min(preview.validRows.length, 50) - 1;
                      return (
                        <View
                          key={`v-${row.rowNumber}`}
                          className={`flex-row items-center justify-between px-3.5 py-2.5 ${
                            !isLast ? 'border-b border-border' : ''
                          }`}
                        >
                          <View className="flex-1 pr-2">
                            <Text className="font-bold text-[13px] text-black">
                              Baris {row.rowNumber}: {row.data.name}
                            </Text>
                            <Text className="mt-0.5 font-medium text-[11.5px] text-muted">
                              {row.data.barcode ?? 'Tanpa barcode'} • Stok {row.data.stock ?? 0}
                            </Text>
                          </View>
                          <Text
                            className="font-extrabold text-[13px] text-black"
                            style={{ fontVariant: ['tabular-nums'] }}
                          >
                            {formatRupiah(row.data.sell_price)}
                          </Text>
                        </View>
                      );
                    })}
                    {preview.validRows.length > 50 ? (
                      <Text className="py-2.5 text-center font-semibold text-[11.5px] text-muted">
                        Menampilkan 50 dari {preview.validRows.length} baris valid.
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View className="gap-2">
                    {preview.errorRows.length === 0 ? (
                      <View className="rounded-card border border-border bg-white p-4">
                        <Text className="font-medium text-[12.5px] text-muted">
                          Tidak ada baris error. Seluruh data siap diimpor.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {preview.errorRows.slice(0, 50).map((row) => (
                          <View
                            key={`e-${row.rowNumber}`}
                            className="rounded-card bg-red-soft px-3.5 py-3"
                          >
                            <Text className="font-extrabold text-[13px] text-red">
                              Baris {row.rowNumber}: {row.rawName}
                            </Text>
                            <Text className="mt-1 font-medium text-[12px] text-red">
                              {row.reasons.join(' • ')}
                            </Text>
                          </View>
                        ))}
                        {preview.errorRows.length > 50 ? (
                          <Text className="py-2 text-center font-semibold text-[11.5px] text-muted">
                            Menampilkan 50 dari {preview.errorRows.length} baris error.
                          </Text>
                        ) : null}
                      </>
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
