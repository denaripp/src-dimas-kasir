import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

interface ProductThumbnailProps {
  imageUrl?: string | null;
  size?: number;
  fillWidth?: boolean;
  aspectRatio?: number;
  iconSize?: number;
  className?: string;
}

const styles = StyleSheet.create({
  fullImage: {
    width: '100%',
    height: '100%',
  },
});

/**
 * Thumbnail foto produk seragam untuk Beranda, Barang, Katalog Kasir, Sheet Checkout, & Laporan.
 * Memakai expo-image dengan memory+disk cache & recyclingKey agar scroll 60fps tanpa kedip.
 */
export const ProductThumbnail = memo(function ProductThumbnail({
  imageUrl,
  size = 48,
  fillWidth = false,
  aspectRatio,
  iconSize = 18,
  className = '',
}: ProductThumbnailProps) {
  const dimensionStyle = useMemo(
    () =>
      fillWidth
        ? { width: '100%' as const, aspectRatio: aspectRatio ?? 4 / 3 }
        : { width: size, height: size },
    [fillWidth, aspectRatio, size],
  );

  return (
    <View
      style={dimensionStyle}
      className={`items-center justify-center overflow-hidden rounded-thumb border border-border bg-surface ${className}`}
    >
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={styles.fullImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          recyclingKey={imageUrl}
        />
      ) : (
        <FontAwesome6 name="cube" size={iconSize} color="#71717A" solid />
      )}
    </View>
  );
});
