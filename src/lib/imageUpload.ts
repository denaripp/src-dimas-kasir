import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { supabase } from '@/lib/supabase';

export type StorageImageBucket = 'product-images' | 'store-logos';

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const TARGET_IMAGE_WIDTH = 512;
const TARGET_JPEG_QUALITY = 0.72;

export function isTrustedSupabaseStorageUrl(
  url: string | null | undefined,
  bucket: StorageImageBucket,
): url is string {
  if (typeof url !== 'string' || !url.trim()) {
    return false;
  }
  const pattern = new RegExp(
    `^https://[a-z0-9-]+\\.supabase\\.co/storage/v1/object/public/${bucket}/`,
    'i',
  );
  return pattern.test(url.trim());
}

export function extractStorageObjectPath(
  publicUrl: string | null | undefined,
  bucket: StorageImageBucket,
): string | null {
  if (!isTrustedSupabaseStorageUrl(publicUrl, bucket)) {
    return null;
  }
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = publicUrl.slice(idx + marker.length).split(/[?#]/)[0] ?? '';
  if (!rawPath || rawPath.includes('..')) {
    return null;
  }
  return decodeURIComponent(rawPath);
}

/**
 * Mengubah ukuran foto ke maksimal lebar 512px (JPEG kualitas 0.72, ~30-60 KB),
 * memvalidasi batas ukuran <= 2 MB, lalu mengunggahnya ke Supabase Storage.
 */
export async function uploadCompressedStorageImage({
  bucket,
  userId,
  prefix,
  localUri,
}: {
  bucket: StorageImageBucket;
  userId: string;
  prefix: 'product' | 'logo';
  localUri: string;
}): Promise<string> {
  const manipulated = await manipulateAsync(
    localUri,
    [{ resize: { width: TARGET_IMAGE_WIDTH } }],
    { compress: TARGET_JPEG_QUALITY, format: SaveFormat.JPEG },
  );

  const response = await fetch(manipulated.uri);
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error('File gambar kosong atau tidak dapat dibaca.');
  }

  if (arrayBuffer.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Ukuran gambar melebihi batas maksimal 2 MB.');
  }

  const filePath = `${userId}/${prefix}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(toUserFriendlyError(uploadError, 'Gagal mengunggah gambar ke server.'));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Menghapus file lama di Supabase Storage (best-effort) saat foto diganti/dihapus
 * agar tidak meninggalkan file yatim.
 */
export async function deleteStorageImageByUrl(
  bucket: StorageImageBucket,
  publicUrl: string | null | undefined,
): Promise<void> {
  const objectPath = extractStorageObjectPath(publicUrl, bucket);
  if (!objectPath) return;

  try {
    await supabase.storage.from(bucket).remove([objectPath]);
  } catch {
    // Cleanup best-effort: jangan menggagalkan alur simpan utama
  }
}
