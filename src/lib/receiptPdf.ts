import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReceiptHtml, type ReceiptRenderOptions } from '@/lib/receiptFormatter';
import type { SaleItemRow, SaleRow } from '@/types/database';

export async function shareReceiptPdf(
  sale: SaleRow,
  items: SaleItemRow[],
  options?: ReceiptRenderOptions,
): Promise<string> {
  const html = buildReceiptHtml(sale, items, options);
  const { uri } = await Print.printToFileAsync({ html });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Fitur bagikan file tidak tersedia di perangkat ini.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Struk ${sale.receipt_number}`,
    UTI: 'com.adobe.pdf',
  });

  return uri;
}
