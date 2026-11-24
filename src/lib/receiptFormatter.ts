import { formatDateTime, formatRupiah } from '@/lib/format';
import type { PaperSize, SaleItemRow, SaleRow, StoreRow } from '@/types/database';

export type ReceiptStoreInfo = Pick<
  StoreRow,
  'name' | 'address' | 'phone' | 'logo_url' | 'receipt_footer' | 'paper_size'
>;

export function getReceiptLineWidth(paperSize: PaperSize): number {
  return paperSize === 80 ? 48 : 32;
}

export function formatTwoColumns(left: string, right: string, width: number): string {
  const cleanLeft = left.trim();
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

export function buildEscPosReceiptText(
  sale: SaleRow,
  items: SaleItemRow[],
  store: ReceiptStoreInfo,
): string {
  const width = getReceiptLineWidth(store.paper_size);
  const doubleDivider = '='.repeat(width);
  const singleDivider = '-'.repeat(width);
  const lines: string[] = [];

  const rawStoreName = sanitizeEscPosText(store.name) || 'TOKO SRC DIMAS';
  const safeName = rawStoreName.toUpperCase();
  const safeAddress =
    sanitizeEscPosText(store.address) || 'Jl. Raya Belawa Wangkelang, Desa Wangkelang';
  const safePhone = sanitizeEscPosText(store.phone);

  const totalDistinctItems = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);

  // 1. Header Toko
  lines.push(doubleDivider);
  lines.push(`<CB>${safeName}</CB>`);
  if (safeAddress) {
    lines.push(`<C>${safeAddress}</C>`);
  }
  if (safePhone) {
    lines.push(`<C>Telp: ${safePhone}</C>`);
  }
  lines.push(doubleDivider);

  // 2. Metadata Transaksi
  lines.push(`No. Struk : ${sanitizeEscPosText(sale.receipt_number)}`);
  lines.push(`Tanggal   : ${formatDateTime(sale.created_at)}`);
  lines.push(`Kasir     : ${rawStoreName}`);

  // 3. Status VOID jika ada
  if (sale.status === 'void') {
    lines.push(singleDivider);
    lines.push('<CB>*** TRANSAKSI VOID ***</CB>');
    const safeVoidReason = sale.void_reason ? sanitizeEscPosText(sale.void_reason) : '';
    if (safeVoidReason) {
      lines.push(`<C>Alasan: ${safeVoidReason}</C>`);
    }
  }

  // 4. Rincian Barang
  lines.push(singleDivider);
  for (const item of items) {
    const itemName = (sanitizeEscPosText(item.product_name_snapshot) || 'BARANG').toUpperCase();
    lines.push(itemName);
    const qtyPrice = `  ${item.qty} x ${formatRupiah(item.sell_price_snapshot)}`;
    const subtotal = formatRupiah(item.subtotal);
    lines.push(formatTwoColumns(qtyPrice, subtotal, width));
  }

  // 5. Total & Pembayaran
  lines.push(singleDivider);
  lines.push(
    formatTwoColumns('Total Item :', `${totalDistinctItems} (${totalUnits} pcs)`, width),
  );
  lines.push(
    `<B>${formatTwoColumns('TOTAL      :', formatRupiah(sale.total_amount), width)}</B>`,
  );
  lines.push(formatTwoColumns('TUNAI      :', formatRupiah(sale.cash_received), width));
  lines.push(formatTwoColumns('KEMBALI    :', formatRupiah(sale.change_amount), width));
  lines.push(doubleDivider);

  // 6. Footer Toko
  const customFooter = sanitizeEscPosText(store.receipt_footer);
  if (customFooter && customFooter !== 'Terima kasih telah berbelanja!') {
    lines.push(`<C>${customFooter}</C>`);
  } else {
    lines.push('<C>Terima Kasih Telah Berbelanja</C>');
    lines.push(`<C>di ${safeName}</C>`);
  }
  lines.push(doubleDivider);

  // 3 baris kosong untuk jarak pemotongan kertas thermal
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

export function buildTestReceiptText(
  store: Pick<StoreRow, 'name' | 'paper_size'> & { address?: string | null },
): string {
  const width = getReceiptLineWidth(store.paper_size);
  const doubleDivider = '='.repeat(width);
  const singleDivider = '-'.repeat(width);
  const safeName = (sanitizeEscPosText(store.name) || 'TOKO SRC DIMAS').toUpperCase();
  const safeAddress =
    sanitizeEscPosText(store.address) || 'Jl. Raya Belawa Wangkelang, Desa Wangkelang';

  return [
    doubleDivider,
    `<CB>${safeName}</CB>`,
    `<C>${safeAddress}</C>`,
    `<C>TES CETAK PRINTER ${store.paper_size}mm</C>`,
    doubleDivider,
    formatTwoColumns('Lebar Baris :', `${width} karakter`, width),
    formatTwoColumns('Format Uang :', formatRupiah(15000), width),
    formatTwoColumns('Waktu       :', formatDateTime(new Date()), width),
    singleDivider,
    '<C>Printer Terhubung & Siap Pakai</C>',
    doubleDivider,
    '',
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

export function buildReceiptHtml(
  sale: SaleRow,
  items: SaleItemRow[],
  store: ReceiptStoreInfo,
): string {
  const paperMm = store.paper_size === 80 ? '80mm' : '58mm';
  const rawStoreName = store.name.trim() || 'Toko SRC Dimas';
  const storeNameUpper = rawStoreName.toUpperCase();
  const storeAddress =
    store.address.trim() || 'Jl. Raya Belawa Wangkelang, Desa Wangkelang';
  const storePhone = store.phone.trim();

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

  const logoHtml = isTrustedLogoUrl(store.logo_url)
    ? `<div class="center"><img class="logo" src="${escapeHtml(store.logo_url)}" alt="Logo Toko" /></div>`
    : '';

  const voidBannerHtml =
    sale.status === 'void'
      ? `
        <div class="void-box">
          <div>*** TRANSAKSI VOID ***</div>
          ${sale.void_reason ? `<div class="void-reason">Alasan: ${escapeHtml(sale.void_reason)}</div>` : ''}
        </div>
      `
      : '';

  const customFooter = store.receipt_footer.trim();
  const footerHtml =
    customFooter && customFooter !== 'Terima kasih telah berbelanja!'
      ? `<div class="footer">${escapeHtml(customFooter)}</div>`
      : `
        <div class="footer">
          <div>Terima Kasih Telah Berbelanja</div>
          <div>di ${escapeHtml(storeNameUpper)}</div>
        </div>
      `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Struk ${escapeHtml(sale.receipt_number)}</title>
  <style>
    @page { margin: 6px; }
    body {
      font-family: 'Courier New', Courier, monospace;
      color: #09090B;
      background: #FFFFFF;
      width: ${paperMm};
      margin: 0 auto;
      padding: 10px 8px;
      font-size: 11.5px;
      line-height: 1.35;
    }
    .center { text-align: center; }
    .logo { max-width: 64px; max-height: 64px; object-fit: contain; margin-bottom: 6px; }
    .store-name { font-size: 14.5px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
    .store-meta { font-size: 11px; color: #27272A; }
    .double-divider { border-top: 2px solid #09090B; margin: 6px 0; }
    .single-divider { border-top: 1px dashed #09090B; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .meta-row { font-size: 11px; margin-bottom: 2px; }
    .item { margin-bottom: 5px; }
    .item-name { font-weight: 700; font-size: 11.5px; }
    .item-detail { font-size: 11px; }
    .qty-price { font-weight: 500; }
    .subtotal { font-weight: 700; }
    .summary-row { margin-bottom: 2px; }
    .total-row { font-size: 13.5px; font-weight: 800; margin: 3px 0; }
    .void-box {
      border: 1.5px solid #D91E2A;
      color: #D91E2A;
      text-align: center;
      font-weight: 800;
      padding: 6px;
      margin: 6px 0;
    }
    .void-reason { font-size: 10.5px; font-weight: 600; margin-top: 2px; }
    .footer { text-align: center; font-size: 11px; font-weight: 600; line-height: 1.4; }
  </style>
</head>
<body>
  ${logoHtml}
  <div class="double-divider"></div>
  <div class="center">
    <div class="store-name">${escapeHtml(storeNameUpper)}</div>
    <div class="store-meta">${escapeHtml(storeAddress)}</div>
    ${storePhone ? `<div class="store-meta">Telp: ${escapeHtml(storePhone)}</div>` : ''}
  </div>
  <div class="double-divider"></div>

  <div class="meta-row">No. Struk : <strong>${escapeHtml(sale.receipt_number)}</strong></div>
  <div class="meta-row">Tanggal   : ${escapeHtml(formatDateTime(sale.created_at))}</div>
  <div class="meta-row">Kasir     : ${escapeHtml(rawStoreName)}</div>

  ${voidBannerHtml}

  <div class="single-divider"></div>

  ${itemRowsHtml}

  <div class="single-divider"></div>

  <div class="row summary-row"><span>Total Item :</span><span>${totalDistinctItems} (${totalUnits} pcs)</span></div>
  <div class="row total-row"><span>TOTAL      :</span><span>${escapeHtml(formatRupiah(sale.total_amount))}</span></div>
  <div class="row summary-row"><span>TUNAI      :</span><span>${escapeHtml(formatRupiah(sale.cash_received))}</span></div>
  <div class="row summary-row"><span>KEMBALI    :</span><strong>${escapeHtml(formatRupiah(sale.change_amount))}</strong></div>

  <div class="double-divider"></div>

  ${footerHtml}

  <div class="double-divider"></div>
</body>
</html>`;
}
