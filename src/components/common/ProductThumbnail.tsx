import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image, View } from 'react-native';

interface ProductThumbnailProps {
  imageUrl?: string | null;
  size?: number;
  fillWidth?: boolean;
  aspectRatio?: number;
  iconSize?: number;
  className?: string;
}

/**
 * Thumbnail foto produk seragam untuk Beranda, Barang, Katalog Kasir, Sheet Checkout, & Laporan.
 * Menampilkan foto produk jika ada, atau kotak permukaan netral #F7F7F8 dengan ikon bersih.
 */
export function ProductThumbnail({
  imageUrl,
  size = 48,
  fillWidth = false,
  aspectRatio,
  iconSize = 18,
  className = '',
}: ProductThumbnailProps) {
  const dimensionStyle = fillWidth
    ? { width: '100%' as const, aspectRatio: aspectRatio ?? 4 / 3 }
    : { width: size, height: size };

  return (
    <View
      style={dimensionStyle}
      className={`items-center justify-center overflow-hidden rounded-thumb border border-border bg-surface ${className}`}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <FontAwesome6 name="cube" size={iconSize} color="#71717A" solid />
      )}
    </View>
  );
}
