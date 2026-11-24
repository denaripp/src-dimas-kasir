import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface ShareCsvOptions {
  filename: string;
  content: string;
  dialogTitle?: string;
}

/**
 * Menulis teks CSV ke direktori cache perangkat lalu membuka sheet bagikan native.
 * Mengembalikan URI file tersimpan jika fitur share tidak tersedia di perangkat.
 */
export async function shareCsvFile({
  filename,
  content,
  dialogTitle,
}: ShareCsvOptions): Promise<{ shared: boolean; fileUri: string }> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('Direktori penyimpanan sementara tidak tersedia.');
  }

  const fileUri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return { shared: false, fileUri };
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: dialogTitle ?? filename,
    UTI: 'public.comma-separated-values-text',
  });

  return { shared: true, fileUri };
}
