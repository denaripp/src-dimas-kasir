import { formatReceiptDateTime, formatRupiah } from '@/lib/format';
import { STORE_BRAND } from '@/lib/storeBrand';
import type { PaperSize, SaleItemRow, SaleRow, StoreRow } from '@/types/database';

export type ReceiptStoreInfo = Pick<
  StoreRow,
  'name' | 'address' | 'phone' | 'logo_url' | 'receipt_footer' | 'paper_size'
>;

export interface ReceiptRenderOptions {
  paper_size?: PaperSize;
  printedAt?: Date | string | number;
}

export function getReceiptLineWidth(paperSize: PaperSize): number {
  return paperSize === 80 ? 48 : 32;
}

export function formatTwoColumns(left: string, right: string, width: number): string {
  const cleanLeft = left.trimEnd();
  const cleanRight = right.trim();
  const maxLeft = Math.max(1, width - cleanRight.length - 1);
  const clippedLeft =
    cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
  const spaces = Math.max(1, width - clippedLeft.length - cleanRight.length);
  return `${clippedLeft}${' '.repeat(spaces)}${cleanRight}`;
}

const TRUSTED_LOGO_URL_REGEX =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/store-logos\//i;

/**
 * Membersihkan teks sebelum dikirim ke soket printer ESC/POS agar karakter kontrol
 * (0x00–0x1F, ESC/GS) atau tag format (<CB>, <B>, <C>) dari input eksternal/CSV
 * tidak dapat menyuntikkan perintah hardware ke printer atau laci kas.
 */
export function sanitizeEscPosText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function isTrustedLogoUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && TRUSTED_LOGO_URL_REGEX.test(url.trim());
}

/**
 * Menghasilkan teks struk thermal ESC/POS (58mm / 80mm) dengan tata letak lega,
 * ukuran huruf ringkasan seragam (tanpa <B> 4x), dan 1 baris Tanggal WIB tanpa detik.
 * Identitas toko dikunci permanen ke STORE_BRAND ("TOKO SRC DIMAS").
 */
export function buildEscPosReceiptText(
  sale: SaleRow,
  items: SaleItemRow[],
  options?: ReceiptRenderOptions | ReceiptStoreInfo,
): string {
  const paperSize: PaperSize = options?.paper_size === 80 ? 80 : 58;
  const width = getReceiptLineWidth(paperSize);
  const divider = '-'.repeat(width);
  const lines: string[] = [];

  const totalDistinctItems = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);

  // 1. Header Toko (lega dengan ruang napas atas & bawah)
  lines.push('');
  lines.push(`<CB>${STORE_BRAND.nameUpper}</CB>`);
  if (paperSize === 80) {
    lines.push(`<C>${STORE_BRAND.address}</C>`);
  } else {
    for (const addrLine of STORE_BRAND.addressLines58) {
      lines.push(`<C>${addrLine}</C>`);
    }
  }
  lines.push('');

  // 2. Metadata Transaksi (1 baris Tanggal WIB DD/MM/YYYY HH:mm)
  lines.push(divider);
  lines.push(`No. Struk : ${sanitizeEscPosText(sale.receipt_number)}`);
  lines.push(`Tanggal   : ${formatReceiptDateTime(sale.created_at)}`);
  lines.push(`Kasir     : ${STORE_BRAND.cashierName}`);
  lines.push(divider);

  // 3. Status VOID jika ada
  if (sale.status === 'void') {
    lines.push('');
    lines.push('<C>*** TRANSAKSI VOID ***</C>');
    const safeVoidReason = sale.void_reason ? sanitizeEscPosText(sale.void_reason) : '';
    if (safeVoidReason) {
      lines.push(`<C>Alasan: ${safeVoidReason}</C>`);
    }
    lines.push('');
    lines.push(divider);
  }

  // 4. Rincian Barang
  lines.push('');
  for (const item of items) {
    const itemName = (sanitizeEscPosText(item.product_name_snapshot) || 'BARANG').toUpperCase();
    lines.push(itemName);
    const qtyPrice = `  ${item.qty} x ${formatRupiah(item.sell_price_snapshot)}`;
    const subtotal = formatRupiah(item.subtotal);
    lines.push(formatTwoColumns(qtyPrice, subtotal, width));
  }
  lines.push('');

  // 5. Total & Pembayaran (ukuran huruf seragam, rata kanan presisi)
  lines.push(divider);
  lines.push('');
  lines.push(formatTwoColumns('Total Item', `${totalDistinctItems} (${totalUnits} pcs)`, width));
  lines.push(formatTwoColumns('TOTAL', formatRupiah(sale.total_amount), width));
  lines.push(formatTwoColumns('TUNAI', formatRupiah(sale.cash_received), width));
  lines.push(formatTwoColumns('KEMBALI', formatRupiah(sale.change_amount), width));
  lines.push('');

  // 6. Footer Toko
  lines.push(divider);
  lines.push('');
  for (const footerLine of STORE_BRAND.footerLines) {
    lines.push(`<C>${footerLine}</C>`);
  }
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

export function buildTestReceiptText(
  options?: ReceiptRenderOptions | (Pick<StoreRow, 'paper_size'> & { name?: string; address?: string | null }),
): string {
  const paperSize: PaperSize = options?.paper_size === 80 ? 80 : 58;
  const printedAt = 'printedAt' in (options ?? {}) ? (options as ReceiptRenderOptions).printedAt : undefined;
  const width = getReceiptLineWidth(paperSize);
  const divider = '-'.repeat(width);

  const addressLines =
    paperSize === 80
      ? [`<C>${STORE_BRAND.address}</C>`]
      : STORE_BRAND.addressLines58.map((line) => `<C>${line}</C>`);

  return [
    '',
    `<CB>${STORE_BRAND.nameUpper}</CB>`,
    ...addressLines,
    `<C>TES CETAK PRINTER ${paperSize}mm</C>`,
    '',
    divider,
    '',
    formatTwoColumns('Lebar Baris', `${width} karakter`, width),
    formatTwoColumns('Format Uang', formatRupiah(15000), width),
    formatTwoColumns('Waktu', formatReceiptDateTime(printedAt ?? new Date()), width),
    '',
    divider,
    '',
    '<C>Printer Terhubung & Siap Pakai</C>',
    '',
    '',
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Menghasilkan HTML struk untuk ekspor PDF / WhatsApp yang selaras 1:1
 * dengan tata letak thermal fisik lega (58mm / 80mm).
 */
export function buildReceiptHtml(
  sale: SaleRow,
  items: SaleItemRow[],
  options?: ReceiptRenderOptions | ReceiptStoreInfo,
): string {
  const paperSize: PaperSize = options?.paper_size === 80 ? 80 : 58;
  const paperMm = paperSize === 80 ? '80mm' : '58mm';

  const totalDistinctItems = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);

  const itemRowsHtml = items
    .map(
      (item) => `
        <div class="item">
          <div class="item-name">${escapeHtml(item.product_name_snapshot.toUpperCase())}</div>
          <div class="row item-detail">
            <span class="qty-price">&nbsp;&nbsp;${item.qty} &times; ${escapeHtml(formatRupiah(item.sell_price_snapshot))}</span>
            <span class="subtotal">${escapeHtml(formatRupiah(item.subtotal))}</span>
          </div>
        </div>
      `,
    )
    .join('');

  const voidBannerHtml =
    sale.status === 'void'
      ? `
        <div class="void-box">
          <div>*** TRANSAKSI VOID ***</div>
          ${sale.void_reason ? `<div class="void-reason">Alasan: ${escapeHtml(sale.void_reason)}</div>` : ''}
        </div>
      `
      : '';

  const footerLinesHtml = STORE_BRAND.footerLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Struk ${escapeHtml(sale.receipt_number)}</title>
  <style>
    @page { margin: 8px; }
    body {
      font-family: 'Courier New', Courier, monospace;
      color: #09090B;
      background: #FFFFFF;
      width: ${paperMm};
      margin: 0 auto;
      padding: 16px 10px;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .center { text-align: center; }
    .header { margin-bottom: 12px; }
    .store-name { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
    .store-meta { font-size: 11px; color: #27272A; }
    .divider { border-top: 1px dashed #09090B; margin: 10px 0; }
    .section { padding: 4px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .meta-row { font-size: 11px; margin-bottom: 3px; white-space: pre; }
    .item { margin-bottom: 7px; }
    .item:last-child { margin-bottom: 0; }
    .item-name { font-weight: 700; font-size: 11.5px; }
    .item-detail { font-size: 11.5px; }
    .qty-price { font-weight: 500; }
    .subtotal { font-weight: 700; }
    .summary-row { font-size: 11.5px; margin-bottom: 4px; }
    .summary-row:last-child { margin-bottom: 0; }
    .total-row { font-size: 11.5px; font-weight: 800; margin-bottom: 4px; }
    .void-box {
      border: 1.5px solid #D91E2A;
      color: #D91E2A;
      text-align: center;
      font-weight: 800;
      padding: 6px;
      margin: 10px 0;
    }
    .void-reason { font-size: 10.5px; font-weight: 600; margin-top: 2px; }
    .footer { text-align: center; font-size: 11px; font-weight: 600; line-height: 1.5; padding-top: 4px; }
  </style>
</head>
<body>
  <div class="center header">
    <div class="store-name">${escapeHtml(STORE_BRAND.nameUpper)}</div>
    <div class="store-meta">${escapeHtml(STORE_BRAND.address)}</div>
  </div>

  <div class="divider"></div>
  <div class="section">
    <div class="meta-row">No. Struk : <strong>${escapeHtml(sale.receipt_number)}</strong></div>
    <div class="meta-row">Tanggal   : ${escapeHtml(formatReceiptDateTime(sale.created_at))}</div>
    <div class="meta-row">Kasir     : ${escapeHtml(STORE_BRAND.cashierName)}</div>
  </div>
  <div class="divider"></div>

  ${voidBannerHtml}

  <div class="section">
    ${itemRowsHtml}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="row summary-row"><span>Total Item</span><span>${totalDistinctItems} (${totalUnits} pcs)</span></div>
    <div class="row total-row"><span>TOTAL</span><span>${escapeHtml(formatRupiah(sale.total_amount))}</span></div>
    <div class="row summary-row"><span>TUNAI</span><span>${escapeHtml(formatRupiah(sale.cash_received))}</span></div>
    <div class="row summary-row"><span>KEMBALI</span><strong>${escapeHtml(formatRupiah(sale.change_amount))}</strong></div>
  </div>

  <div class="divider"></div>

  <div class="footer">${footerLinesHtml}</div>
</body>
</html>`;
}
