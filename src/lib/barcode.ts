/**
 * src dimas kasir - Barcode & QR Normalization, Matching & Multi-Frame Scan Consensus
 *
 * Mengatasi variasi pembacaan hardware camera/HID scanner:
 * - Menghapus karakter kontrol tak terlihat (ASCII 0x00-0x1F, 0x7F)
 * - Menghapus line breaks (\r, \n) dan tabs (\t)
 * - Menghapus zero-width spaces (\u200B-\u200D), BOM (\uFEFF)
 * - Trim spasi luar
 * - Toleransi perbandingan UPC-A (12 digit) vs EAN-13 (13 digit dengan leading zero)
 * - Toleransi decoding URL jika payload berupa tautan ter-encode
 * - Filter konsensus multi-frame untuk menolak salah baca 1 frame buram pada kemasan plastik
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

export interface ScanConsensusConfig {
  required1dFrames?: number;
  required2dFrames?: number;
  consensusWindowMs?: number;
  globalCooldownMs?: number;
}

const DEFAULT_REQUIRED_1D_FRAMES = 3;
const DEFAULT_REQUIRED_2D_FRAMES = 2;
const DEFAULT_CONSENSUS_WINDOW_MS = 650;
const DEFAULT_GLOBAL_COOLDOWN_MS = 1200;

const TWO_D_BARCODE_TYPES = new Set(['qr', 'aztec', 'datamatrix', 'pdf417']);

/**
 * Filter stabilitas multi-frame untuk kamera scanner.
 * Mencegah 1 frame buram/pantulan cahaya pada barcode 1D (EAN-13/UPC-A/Code39)
 * langsung dianggap hasil scan valid, serta menerapkan global cooldown pasca-scan.
 */
export class BarcodeScanConsensus {
  private readonly required1dFrames: number;
  private readonly required2dFrames: number;
  private readonly consensusWindowMs: number;
  private readonly globalCooldownMs: number;

  private candidateCode = '';
  private candidateCount = 0;
  private lastCandidateAt = 0;
  private lastEmittedAt = -Infinity;

  constructor(config?: ScanConsensusConfig) {
    this.required1dFrames = config?.required1dFrames ?? DEFAULT_REQUIRED_1D_FRAMES;
    this.required2dFrames = config?.required2dFrames ?? DEFAULT_REQUIRED_2D_FRAMES;
    this.consensusWindowMs = config?.consensusWindowMs ?? DEFAULT_CONSENSUS_WINDOW_MS;
    this.globalCooldownMs = config?.globalCooldownMs ?? DEFAULT_GLOBAL_COOLDOWN_MS;
  }

  reset(): void {
    this.candidateCode = '';
    this.candidateCount = 0;
    this.lastCandidateAt = 0;
    this.lastEmittedAt = -Infinity;
  }

  feed(
    rawCode: string | null | undefined,
    barcodeType?: string,
    nowMs: number = Date.now(),
  ): string | null {
    const code = normalizeBarcode(rawCode);
    if (!code) {
      return null;
    }

    // Global cooldown: abaikan SEMUA frame (kode sama maupun kode berbeda) tepat setelah scan sukses
    if (nowMs - this.lastEmittedAt < this.globalCooldownMs) {
      return null;
    }

    const isWithinWindow = nowMs - this.lastCandidateAt <= this.consensusWindowMs;
    if (code === this.candidateCode && isWithinWindow) {
      this.candidateCount += 1;
    } else {
      this.candidateCode = code;
      this.candidateCount = 1;
    }
    this.lastCandidateAt = nowMs;

    const normalizedType = (barcodeType ?? '').toLowerCase();
    const requiredFrames = TWO_D_BARCODE_TYPES.has(normalizedType)
      ? this.required2dFrames
      : this.required1dFrames;

    if (this.candidateCount >= requiredFrames) {
      this.lastEmittedAt = nowMs;
      this.candidateCode = '';
      this.candidateCount = 0;
      this.lastCandidateAt = 0;
      return code;
    }

    return null;
  }
}
