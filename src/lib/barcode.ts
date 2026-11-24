/**
 * src dimas kasir - Barcode & QR Normalization & Matching
 *
 * Mengatasi variasi pembacaan hardware camera/HID scanner:
 * - Menghapus karakter kontrol tak terlihat (ASCII 0x00-0x1F, 0x7F)
 * - Menghapus line breaks (\r, \n) dan tabs (\t)
 * - Menghapus zero-width spaces (\u200B-\u200D), BOM (\uFEFF)
 * - Trim spasi luar
 * - Toleransi perbandingan UPC-A (12 digit) vs EAN-13 (13 digit dengan leading zero)
 * - Toleransi decoding URL jika payload berupa tautan ter-encode
 */

export function normalizeBarcode(code: string | null | undefined): string {
  if (!code) return '';
  return code
    .replace(/[\x00-\x1F\x7F\uFEFF\u200B-\u200D]/g, '')
    .trim();
}

/**
 * Mencocokkan barcode produk di database dengan hasil scan scanner/kamera.
 */
export function matchBarcode(
  productBarcode: string | null | undefined,
  scannedBarcode: string | null | undefined,
): boolean {
  const normProduct = normalizeBarcode(productBarcode).toLowerCase();
  const normScanned = normalizeBarcode(scannedBarcode).toLowerCase();

  if (!normProduct || !normScanned) {
    return false;
  }

  // 1. Pencocokan langsung (case-insensitive)
  if (normProduct === normScanned) {
    return true;
  }

  // 2. Toleransi UPC-A (12 digit) vs EAN-13 (13 digit dengan leading zero)
  if (/^\d{12,13}$/.test(normProduct) && /^\d{12,13}$/.test(normScanned)) {
    const unpaddedProduct = normProduct.replace(/^0+/, '');
    const unpaddedScanned = normScanned.replace(/^0+/, '');
    if (unpaddedProduct.length >= 11 && unpaddedProduct === unpaddedScanned) {
      return true;
    }
  }

  // 3. Toleransi URL decoding jika barcode mengandung encoded char
  if (normProduct.includes('%') || normScanned.includes('%')) {
    try {
      const decodedProduct = decodeURIComponent(normProduct);
      const decodedScanned = decodeURIComponent(normScanned);
      if (decodedProduct === decodedScanned) {
        return true;
      }
    } catch {
      // Abaikan jika bukan format URI yang valid
    }
  }

  return false;
}
