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

export function buildEscPosReceiptText(
  sale: SaleRow,
  items: SaleItemRow[],
  store: ReceiptStoreInfo,
): string {
  const width = getReceiptLineWidth(store.paper_size);
  const divider = '-'.repeat(width);
  const lines: string[] = [];

  lines.push(`<CB>${store.name.trim()}</CB>`);
  if (store.address.trim()) {
    lines.push(`<C>${store.address.trim()}</C>`);
  }
  if (store.phone.trim()) {
    lines.push(`<C>${store.phone.trim()}</C>`);
  }

  lines.push(divider);
  lines.push(formatTwoColumns('No:', sale.receipt_number, width));
  lines.push(formatTwoColumns('Tgl:', formatDateTime(sale.created_at), width));

  if (sale.status === 'void') {
    lines.push(divider);
    lines.push('<CB>*** TRANSAKSI VOID ***</CB>');
    if (sale.void_reason) {
      lines.push(`<C>Alasan: ${sale.void_reason}</C>`);
    }
  }

  lines.push(divider);

  for (const item of items) {
    lines.push(item.product_name_snapshot);
    const qtyPrice = `${item.qty} x ${formatRupiah(item.sell_price_snapshot)}`;
    const subtotal = formatRupiah(item.subtotal);
    lines.push(formatTwoColumns(qtyPrice, subtotal, width));
  }

  lines.push(divider);
  lines.push(`<B>${formatTwoColumns('TOTAL', formatRupiah(sale.total_amount), width)}</B>`);
  lines.push(formatTwoColumns('TUNAI', formatRupiah(sale.cash_received), width));
  lines.push(formatTwoColumns('KEMBALIAN', formatRupiah(sale.change_amount), width));
  lines.push(divider);

  if (store.receipt_footer.trim()) {
    lines.push(`<C>${store.receipt_footer.trim()}</C>`);
  }
  lines.push('');

  return lines.join('\n');
}

export function buildTestReceiptText(
  store: Pick<StoreRow, 'name' | 'paper_size'>,
): string {
  const width = getReceiptLineWidth(store.paper_size);
  const divider = '-'.repeat(width);

  return [
    `<CB>${store.name.trim()}</CB>`,
    `<C>TES CETAK PRINTER ${store.paper_size}mm</C>`,
    divider,
    formatTwoColumns('Lebar Baris', `${width} kar`, width),
    formatTwoColumns('Format Harga', formatRupiah(15000), width),
    formatTwoColumns('Waktu', formatDateTime(new Date()), width),
    divider,
    '<C>Printer terhubung & siap pakai</C>',
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
  const itemRowsHtml = items
    .map(
      (item) => `
        <div class="item">
          <div class="item-name">${escapeHtml(item.product_name_snapshot)}</div>
          <div class="row">
            <span>${item.qty} &times; ${escapeHtml(formatRupiah(item.sell_price_snapshot))}</span>
            <strong>${escapeHtml(formatRupiah(item.subtotal))}</strong>
          </div>
        </div>
      `,
    )
    .join('');

  const logoHtml = store.logo_url
    ? `<div class="center"><img class="logo" src="${escapeHtml(store.logo_url)}" alt="Logo Toko" /></div>`
    : '';

  const voidBannerHtml =
    sale.status === 'void'
      ? `
        <div class="void-box">
          <div>TRANSAKSI VOID</div>
          ${sale.void_reason ? `<div class="void-reason">Alasan: ${escapeHtml(sale.void_reason)}</div>` : ''}
        </div>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { margin: 8px; }
    body {
      font-family: 'Courier New', Courier, monospace;
      color: #09090B;
      background: #FFFFFF;
      width: ${paperMm};
      margin: 0 auto;
      padding: 8px;
      font-size: 12px;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .logo { max-width: 64px; max-height: 64px; object-fit: contain; margin-bottom: 6px; }
    .store-name { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
    .meta { font-size: 11px; }
    .divider { border-top: 1px dashed #09090B; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .item { margin-bottom: 6px; }
    .item-name { font-weight: 700; }
    .total-row { font-size: 14px; font-weight: 800; margin-bottom: 3px; }
    .void-box {
      border: 1.5px solid #D91E2A;
      color: #D91E2A;
      text-align: center;
      font-weight: 800;
      padding: 6px;
      margin: 8px 0;
    }
    .void-reason { font-size: 11px; font-weight: 600; margin-top: 2px; }
    .footer { text-align: center; margin-top: 10px; font-size: 11px; }
  </style>
</head>
<body>
  ${logoHtml}
  <div class="center">
    <div class="store-name">${escapeHtml(store.name)}</div>
    ${store.address.trim() ? `<div class="meta">${escapeHtml(store.address)}</div>` : ''}
    ${store.phone.trim() ? `<div class="meta">${escapeHtml(store.phone)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="row meta"><span>No Struk</span><strong>${escapeHtml(sale.receipt_number)}</strong></div>
  <div class="row meta"><span>Tanggal</span><span>${escapeHtml(formatDateTime(sale.created_at))}</span></div>

  ${voidBannerHtml}

  <div class="divider"></div>

  ${itemRowsHtml}

  <div class="divider"></div>

  <div class="row total-row"><span>TOTAL</span><span>${escapeHtml(formatRupiah(sale.total_amount))}</span></div>
  <div class="row"><span>TUNAI</span><span>${escapeHtml(formatRupiah(sale.cash_received))}</span></div>
  <div class="row"><span>KEMBALIAN</span><strong>${escapeHtml(formatRupiah(sale.change_amount))}</strong></div>

  <div class="divider"></div>

  ${store.receipt_footer.trim() ? `<div class="footer">${escapeHtml(store.receipt_footer)}</div>` : ''}
</body>
</html>`;
}
